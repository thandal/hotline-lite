const crypto = require('crypto');
const fs = require('fs');
const zlib = require('zlib');

// Twilio Sync rate-limit buckets are scoped *per top-level resource* (per
// Document, per Map, per List). Items inside a single Sync Map share one
// bucket — that's what threw the `Rate limit exceeded for write-map-keystore`
// errors in earlier versions. By making every chunk its own Sync Document,
// each chunk gets its own 20/s burst + 2/s sustained allocation, so writing
// the chunked DB in parallel is no longer rate-limited.
//
// Per https://www.twilio.com/docs/sync/limits each Document holds up to
// ~16 KiB of JSON. With base64 (~4/3 expansion) and a `{"b64":"..."}` wrapper,
// 11 KiB raw lands at ~14.7 KiB stored — fits with a small safety margin.
const CHUNK_BYTES = 11 * 1024;
const META_DOC = 'keystore-meta';
const PARALLELISM = 8;
const MAX_429_RETRIES = 5;

// A/B double-buffered layout. Each persist writes to the inactive slot and
// flips `current` via a single If-Match'd meta update. If the flip fails
// (another writer beat us, or the write was partial), the previous slot stays
// authoritative and readable. On load, if the current slot's chunks don't hash
// to the expected sha, we fall back to the other slot automatically.
//
// Meta document shape (stored at `keystore-meta`):
//   {
//     current: 'a' | 'b',              // which slot is authoritative
//     slots: {
//       a: { total_chunks, size_bytes, sha256, compression } | null,
//       b: { total_chunks, size_bytes, sha256, compression } | null,
//     },
//     updated_at: ISO-8601 string
//   }
//
// Chunk document names: `keystore-<slot>-chunk-<5-digit-index>` e.g.
// `keystore-a-chunk-00000`.
const DOC_PREFIX = 'keystore-';
const chunkDocName = (slot, i) =>
  `${DOC_PREFIX}${slot}-chunk-${String(i).padStart(5, '0')}`;

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function parallelLimit(items, fn, limit) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

// Per-Document buckets are generous, but burst-window + create-rate quotas
// can still push a 429 in heavy concurrent traffic. Wrap every write with a
// 429-aware retry that honors the Retry-After hint.
async function withSyncBackoff(label, fn) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err && err.status === 429 && attempt < MAX_429_RETRIES) {
        const retryAfter = Number(
          (err.headers && (err.headers['retry-after'] || err.headers['Retry-After'])) || 0
        );
        const baseMs = retryAfter > 0 ? retryAfter * 1000 : 200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        const wait = Math.min(baseMs + jitter, 15000);
        console.warn(`[syncStore] 429 on ${label}, sleeping ${wait}ms (attempt ${attempt + 1}/${MAX_429_RETRIES})`);
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

async function readDoc(sync, name) {
  try {
    const doc = await sync.documents(name).fetch();
    return { data: doc.data, revision: doc.revision };
  } catch (err) {
    if (err.status === 404) return { data: null, revision: null };
    throw err;
  }
}

// Create-or-update a Document by uniqueName. Twilio doesn't expose an upsert,
// so we try create first and fall back to update on 409.
async function putDoc(sync, name, data, ifMatch) {
  return withSyncBackoff(`putDoc(${name})`, async () => {
    if (ifMatch) {
      return await sync.documents(name).update({ data, ifMatch });
    }
    try {
      return await sync.documents.create({ uniqueName: name, data });
    } catch (err) {
      if (err.status === 409) return await sync.documents(name).update({ data });
      throw err;
    }
  });
}

async function removeDoc(sync, name) {
  try {
    await sync.documents(name).remove();
  } catch (err) {
    if (err.status !== 404) {
      console.warn(`[syncStore] removeDoc(${name}) failed: ${err.message}`);
    }
  }
}

async function readMeta(sync) {
  return readDoc(sync, META_DOC);
}

async function writeMeta(sync, data, prevRevision) {
  return putDoc(sync, META_DOC, data, prevRevision || undefined);
}

function decompressIfNeeded(buf) {
  // Magic bytes 0x1f 0x8b = gzip. We always gzip on write, but check anyway in
  // case old-format data is still present.
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return zlib.gunzipSync(buf);
  return buf;
}

async function readSlot(sync, slotInfo, slotName) {
  if (!slotInfo || !slotInfo.total_chunks) {
    throw new Error(`slot ${slotName} is empty`);
  }
  const names = Array.from(
    { length: slotInfo.total_chunks },
    (_, i) => chunkDocName(slotName, i)
  );
  const chunks = await parallelLimit(names, async (n) => {
    const doc = await sync.documents(n).fetch();
    return Buffer.from(doc.data.b64, 'base64');
  }, PARALLELISM);
  const stored = Buffer.concat(chunks);
  const db = decompressIfNeeded(stored);
  const sha = sha256Hex(db);
  if (sha !== slotInfo.sha256) {
    throw new Error(`slot ${slotName} sha256 mismatch: got ${sha}, expected ${slotInfo.sha256}`);
  }
  return db;
}

async function loadDb(sync, dbPath) {
  const meta = await readMeta(sync);
  if (!meta.data || !meta.data.slots) {
    throw new Error('keystore not initialized in Twilio Sync — run registration first');
  }
  const { current, slots } = meta.data;
  const order = current === 'b' ? ['b', 'a'] : ['a', 'b'];
  const errors = [];
  for (const slotName of order) {
    const info = slots[slotName];
    if (!info) continue;
    try {
      const db = await readSlot(sync, info, slotName);
      fs.writeFileSync(dbPath, db);
      if (slotName !== current) {
        console.warn(`[syncStore] loaded keystore from fallback slot ${slotName} — slot ${current} was unreadable`);
      }
      // Annotate `meta` with the slot we actually loaded from. persistDb uses
      // this so it never overwrites the slot whose data we just trusted: the
      // next write goes into the *other* slot, leaving the known-good copy
      // intact until the meta-flip makes the new write authoritative.
      meta.loadedSlot = slotName;
      return { prev: meta, sizeBytes: db.length, loadedSlot: slotName };
    } catch (err) {
      errors.push(`${slotName}: ${err.message}`);
    }
  }
  throw new Error(`keystore unreadable from either slot: ${errors.join('; ')}`);
}

async function persistDb(sync, dbPath, prevMeta) {
  const db = fs.readFileSync(dbPath);
  const sha = sha256Hex(db);
  const stored = zlib.gzipSync(db, { level: 9 });

  const prevData = (prevMeta && prevMeta.data) || { current: null, slots: { a: null, b: null } };

  // Prefer to overwrite the slot we did NOT just load from — that way the
  // copy whose chunks we're verified to be able to read stays intact during
  // the new write. Fall back to "the inactive slot per `current`" when we
  // didn't load anything (e.g. fresh registration or external upload).
  let target;
  if (prevMeta && prevMeta.loadedSlot) {
    target = prevMeta.loadedSlot === 'a' ? 'b' : 'a';
  } else {
    target = prevData.current === 'a' ? 'b' : 'a';
  }

  const chunks = [];
  for (let i = 0; i < stored.length; i += CHUNK_BYTES) {
    chunks.push(stored.subarray(i, i + CHUNK_BYTES));
  }

  const jobs = chunks.map((buf, i) => ({
    name: chunkDocName(target, i),
    data: { b64: buf.toString('base64') },
  }));
  await parallelLimit(jobs, (j) => putDoc(sync, j.name, j.data), PARALLELISM);

  const newSlot = {
    total_chunks: chunks.length,
    size_bytes: db.length,
    sha256: sha,
    compression: 'gzip',
  };

  const newMeta = {
    current: target,
    slots: {
      a: target === 'a' ? newSlot : (prevData.slots && prevData.slots.a) || null,
      b: target === 'b' ? newSlot : (prevData.slots && prevData.slots.b) || null,
    },
    updated_at: new Date().toISOString(),
  };

  try {
    await writeMeta(sync, newMeta, prevMeta && prevMeta.revision);
  } catch (err) {
    if (err.status === 412) {
      throw new Error('keystore revision conflict — another invocation wrote while we were working');
    }
    throw err;
  }

  // Best-effort cleanup: if the target slot previously held more chunks than
  // we just wrote, delete the stragglers so they don't confuse a future read.
  const prevSlotInfo = prevData.slots && prevData.slots[target];
  const prevTotal = (prevSlotInfo && prevSlotInfo.total_chunks) || 0;
  if (prevTotal > chunks.length) {
    const stale = Array.from(
      { length: prevTotal - chunks.length },
      (_, i) => chunkDocName(target, chunks.length + i)
    );
    await parallelLimit(stale, (n) => removeDoc(sync, n), PARALLELISM);
  }

  return { slot: target, totalChunks: chunks.length, sizeBytes: db.length, compressedBytes: stored.length, sha256: sha };
}

// Removes every keystore-* Document plus the legacy `keystore` Sync Map.
// Useful when the keystore is in an unrecoverable state and the admin wants
// to re-register fresh. Best-effort: any leftover noise here just lingers.
async function resetKeystore(sync) {
  try {
    const docs = await sync.documents.list({ limit: 2000 });
    const ours = docs.filter((d) => d.uniqueName && d.uniqueName.startsWith(DOC_PREFIX));
    await parallelLimit(ours, (d) => removeDoc(sync, d.uniqueName), PARALLELISM);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  // Also blow away the legacy Sync Map left over from the pre-Documents
  // implementation, so older deployments cleaning up don't see ghost meta.
  try {
    await sync.syncMaps('keystore').remove();
  } catch (err) {
    if (err.status !== 404) {
      console.warn(`[syncStore] legacy map cleanup failed: ${err.message}`);
    }
  }
}

module.exports = { loadDb, persistDb, resetKeystore, META_DOC, CHUNK_BYTES };
