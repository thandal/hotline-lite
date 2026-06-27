const crypto = require('crypto');

function token(context, salt) {
  return crypto.createHmac('sha1', context.AUTH_TOKEN)
    .update(context.ACCOUNT_SID + context.ADMIN_PASSWORD + salt)
    .digest('hex');
}

// Ensures the Signal keystore Sync Service exists and the SYNC_SERVICE_SID env var
// points at it. Returns the SID. Handles three cases: env var already valid, env var
// stale/unset (service missing), no env var at all.
async function ensureSyncService(client, env, vars) {
  const existing = vars.find(v => v.key === 'SYNC_SERVICE_SID');
  if (existing && existing.value) {
    try {
      await client.sync.v1.services(existing.value).fetch();
      return existing.value;
    } catch (err) {
      if (err.status !== 404) throw err;
      // fall through and recreate
    }
  }
  const created = await client.sync.v1.services.create({ friendlyName: 'hotline-signal-keystore' });
  if (existing) await env.variables(existing.sid).update({ value: created.sid });
  else await env.variables.create({ key: 'SYNC_SERVICE_SID', value: created.sid });
  return created.sid;
}

const fs = require('fs');

// Usage panel: top-level categories only. Twilio's categories are hierarchical
// (e.g. `calls` already includes calls-inbound/outbound), so summing children
// alongside parents would double-count the total.
const USAGE_CATEGORIES = [
  { category: 'calls', label: 'Calls' },
  { category: 'sms', label: 'Messages' },
  { category: 'recordings', label: 'Recordings' },
];

exports.handler = async function (context, event, callback) {
  const resp = new Twilio.Response();
  resp.appendHeader('Content-Type', 'application/json');

  // Login
  if (event.action === 'login') {
    if (!context.ADMIN_PASSWORD) {
      resp.setStatusCode(500);
      resp.setBody({ error: 'ADMIN_PASSWORD not configured' });
      return callback(null, resp);
    }
    if (event.password !== context.ADMIN_PASSWORD) {
      resp.setStatusCode(401);
      resp.setBody({ error: 'Invalid password' });
      return callback(null, resp);
    }
    const salt = crypto.randomBytes(16).toString('hex');
    resp.setBody({ token: token(context, salt), salt });
    return callback(null, resp);
  }

  // Auth check for all other actions
  if (!event.token || !event.salt ||
      !crypto.timingSafeEqual(Buffer.from(event.token), Buffer.from(token(context, event.salt)))) {
    resp.setStatusCode(401);
    resp.setBody({ error: 'Unauthorized' });
    return callback(null, resp);
  }

  const client = context.getTwilioClient();
  const env = client.serverless.v1.services(context.SERVICE_SID).environments(context.ENVIRONMENT_SID);
  const vars = await env.variables.list();

  try {
    if (event.action === 'status') {
      const operators = vars.filter(v => /^worker/i.test(v.key)).map(v => {
        try { return { key: v.key, sid: v.sid, ...JSON.parse(v.value) }; }
        catch { return { key: v.key, sid: v.sid, raw: v.value }; }
      });
      const bv = vars.find(v => v.key === 'BLOCKLIST');
      const bval = bv ? bv.value : 'null';
      const blocklist = bval === 'null' ? [] : bval.split(',').filter(Boolean);
      const lv = vars.find(v => v.key === 'LANGUAGES');
      const languages = lv ? lv.value.split(',') : [];
      const hv = vars.find(v => v.key === 'HOTLINE_NAME');
      const hotlineName = hv && hv.value ? hv.value.split(',') : [];
      const csv = vars.find(v => v.key === 'CONNECTION_SEQUENCES');
      let connectionSequences = [];
      if (csv && csv.value) { try { connectionSequences = JSON.parse(csv.value); } catch { connectionSequences = []; } }
      if (!Array.isArray(connectionSequences)) connectionSequences = [];
      const av = vars.find(v => v.key === 'ALLOWLIST_ONLY');
      const allowlistOnly = av ? av.value === 'true' : false;
      const iv = vars.find(v => v.key === 'ICS_URL');
      const icsUrl = iv ? iv.value : '';

      // Usage summary for the dashboard. Isolated so a usage-API failure leaves
      // the rest of the status payload intact. The base records resource defaults
      // to all-time totals; a startDate gives the trailing-30-day window.
      let usage = [];
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [recent, allTime] = await Promise.all([
          client.usage.records.list({ startDate: since, pageSize: 1000 }),
          client.usage.records.list({ pageSize: 1000 }),
        ]);
        const byCategory = list => list.reduce((m, u) => (m[u.category] = u, m), {});
        const r30 = byCategory(recent);
        const rAll = byCategory(allTime);
        usage = USAGE_CATEGORIES.map(({ category, label }) => {
          const n = r30[category] || {};
          const a = rAll[category] || {};
          return {
            label,
            usageUnit: a.usageUnit || n.usageUnit || '',
            last30: { usage: Number(n.usage) || 0, price: Number(n.price) || 0 },
            total: { usage: Number(a.usage) || 0, price: Number(a.price) || 0 },
          };
        });
      } catch (e) {
        console.error('usage_fetch_failed ' + (e.message || e));
      }

      resp.setBody({ operators, blocklist, languages, hotlineName, connectionSequences, allowlistOnly, icsUrl, usage });

    } else if (event.action === 'add-operator') {
      const key = 'worker' + event.phone.slice(-4);
      if (vars.find(v => v.key === key)) {
        resp.setStatusCode(409);
        resp.setBody({ error: 'Worker key "' + key + '" already exists' });
        return callback(null, resp);
      }
      await env.variables.create({ key, value: JSON.stringify({ names: event.names, phone: event.phone, languages: event.languages }) });
      resp.setBody({ ok: true });

    } else if (event.action === 'update-operator') {
      const v = vars.find(v => v.key === event.key);
      if (!v) { resp.setStatusCode(404); resp.setBody({ error: 'Not found' }); return callback(null, resp); }
      await env.variables(v.sid).update({ value: JSON.stringify({ names: event.names, phone: event.phone, languages: event.languages }) });
      resp.setBody({ ok: true });

    } else if (event.action === 'remove-operator') {
      const v = vars.find(v => v.key === event.key);
      if (!v) { resp.setStatusCode(404); resp.setBody({ error: 'Not found' }); return callback(null, resp); }
      await env.variables(v.sid).remove();
      resp.setBody({ ok: true });

    } else if (event.action === 'update-blocklist') {
      const value = event.blocklist.length === 0 ? 'null' : event.blocklist.join(',');
      const v = vars.find(v => v.key === 'BLOCKLIST');
      if (v) await env.variables(v.sid).update({ value });
      else await env.variables.create({ key: 'BLOCKLIST', value });
      resp.setBody({ ok: true });

    } else if (event.action === 'update-languages') {
      const value = event.languages.join(',');
      const v = vars.find(v => v.key === 'LANGUAGES');
      if (v) await env.variables(v.sid).update({ value });
      else await env.variables.create({ key: 'LANGUAGES', value });
      resp.setBody({ ok: true });

    } else if (event.action === 'update-hotline-name') {
      // A comma-separated HOTLINE_NAME is read as one name per language, in
      // LANGUAGES order (see hotline.protected.js). An empty list clears the
      // var so the built-in per-language defaults take over.
      const names = (event.hotlineName || []).map(s => s.trim());
      const value = names.join(',');
      const v = vars.find(v => v.key === 'HOTLINE_NAME');
      if (value === '') {
        if (v) await env.variables(v.sid).remove();
      } else if (v) {
        await env.variables(v.sid).update({ value });
      } else {
        await env.variables.create({ key: 'HOTLINE_NAME', value });
      }
      resp.setBody({ ok: true });

    } else if (event.action === 'update-connection-sequences') {
      // Special call handling: a single CONNECTION_SEQUENCES var holds the whole
      // list as JSON [{number, pause, sequence}, ...]. The dashboard edits the
      // array client-side and posts the full replacement (like blocklist/languages).
      const E164 = /^\+\d{7,15}$/;
      const SEQ = /^[0-9*#wW]*$/;  // DTMF digits plus 'w' (0.5s wait) — see <Play digits>
      const raw = Array.isArray(event.sequences) ? event.sequences : [];
      const clean = [];
      for (const item of raw) {
        const number = ((item && item.number) || '').toString().trim();
        const sequence = ((item && item.sequence) || '').toString().trim();
        let pause = parseInt(item && item.pause, 10);
        if (!Number.isFinite(pause) || pause < 0) pause = 0;
        if (pause > 60) pause = 60;
        if (!E164.test(number) || !SEQ.test(sequence)) {
          resp.setStatusCode(400);
          resp.setBody({ error: 'Each entry needs a valid E.164 number and a key sequence of digits, *, #, or w' });
          return callback(null, resp);
        }
        clean.push({ number, pause, sequence });
      }
      const value = JSON.stringify(clean);
      const v = vars.find(v => v.key === 'CONNECTION_SEQUENCES');
      if (v) await env.variables(v.sid).update({ value });
      else await env.variables.create({ key: 'CONNECTION_SEQUENCES', value });
      resp.setBody({ ok: true });

    } else if (event.action === 'update-allowlist-only') {
      // When 'true', hotline.protected.js rejects any caller not present in
      // CONNECTION_SEQUENCES (an allowlist layered on top of the blocklist).
      const value = event.allowlistOnly ? 'true' : 'false';
      const v = vars.find(v => v.key === 'ALLOWLIST_ONLY');
      if (v) await env.variables(v.sid).update({ value });
      else await env.variables.create({ key: 'ALLOWLIST_ONLY', value });
      resp.setBody({ ok: true });

    } else if (event.action === 'update-ics-url') {
      // ICS_URL is the iCalendar feed updateWorkers.private.js polls on each
      // inbound call to learn who is on call. An empty value removes the var;
      // worker sync then has no feed to fetch (the dashboard warns first).
      const value = (event.icsUrl || '').toString().trim();
      if (value !== '' && !/^https?:\/\//i.test(value)) {
        resp.setStatusCode(400);
        resp.setBody({ error: 'Calendar URL must be an http(s) URL' });
        return callback(null, resp);
      }
      const v = vars.find(v => v.key === 'ICS_URL');
      if (value === '') {
        if (v) await env.variables(v.sid).remove();
      } else if (v) {
        await env.variables(v.sid).update({ value });
      } else {
        await env.variables.create({ key: 'ICS_URL', value });
      }
      resp.setBody({ ok: true });

    } else if (event.action === 'dashboard') {
      const dashPath = Runtime.getAssets()['/dashboard.html'].path;
      resp.setBody({ html: fs.readFileSync(dashPath, 'utf8') });

    } else if (event.action === 'send-test-signal') {
      const message = (event.message || '').toString();
      if (!message.trim()) {
        resp.setStatusCode(400);
        resp.setBody({ error: 'Message cannot be empty' });
        return callback(null, resp);
      }
      if (!context.GROUP_KEY) {
        resp.setStatusCode(400);
        resp.setBody({ error: 'No active group set. Pick a group from the Groups list first.' });
        return callback(null, resp);
      }
      const syncSid = await ensureSyncService(client, env, vars);
      context.SYNC_SERVICE_SID = syncSid;
      const { notify } = require(Runtime.getAssets()['/notify.js'].path);
      const result = await notify(context, message);
      if (result === 'OK') resp.setBody({ ok: true });
      else { resp.setStatusCode(500); resp.setBody({ error: 'Failed to send Signal message' }); }

    } else if (event.action === 'signal-status') {
      const signal = require(Runtime.getAssets()['/signalOps.js'].path);
      const groupKeyVar = vars.find(v => v.key === 'GROUP_KEY');
      const activeGroupKey = groupKeyVar ? groupKeyVar.value : null;
      const numbers = await client.incomingPhoneNumbers.list({ limit: 1 });
      const hotlinePhone = numbers[0] ? numbers[0].phoneNumber : null;
      const syncSid = await ensureSyncService(client, env, vars);
      context.SYNC_SERVICE_SID = syncSid;

      let keystore = null;
      try {
        const metaItem = await client.sync.v1.services(syncSid).documents('keystore-meta').fetch();
        const m = metaItem.data || {};
        const s = m.slots || {};
        keystore = {
          current: m.current || null,
          updated_at: m.updated_at || null,
          a: s.a ? { chunks: s.a.total_chunks, size: s.a.size_bytes } : null,
          b: s.b ? { chunks: s.b.total_chunks, size: s.b.size_bytes } : null,
        };
      } catch (e) { /* no meta yet; keystore stays null */ }

      try {
        const bundle = await signal.statusBundle(context);
        const activeKeyLower = (activeGroupKey || '').toLowerCase();
        const activeGroupLine = activeGroupKey
          ? bundle.groupLines.find(l => l.toLowerCase().startsWith(activeKeyLower)) || null
          : null;
        resp.setBody({
          registered: true,
          whoami: bundle.whoami,
          profile: bundle.profile,
          activeGroupKey,
          activeGroupLine,
          knownGroupCount: bundle.groupLines.length,
          hotlinePhone,
          keystore,
        });
      } catch (err) {
        const notInitialised = /keystore not initialized/i.test(err.message);
        const notRegistered = /not yet registered/i.test(err.message);
        const friendly = notInitialised || notRegistered ? 'Ready to register' : err.message;
        resp.setBody({
          registered: false,
          error: friendly,
          profile: {},
          activeGroupKey,
          activeGroupLine: null,
          knownGroupCount: 0,
          hotlinePhone,
          keystore,
        });
      }

    } else if (event.action === 'signal-register') {
      const captcha = (event.captcha || '').trim();
      if (!captcha.startsWith('signalcaptcha://')) {
        resp.setStatusCode(400); resp.setBody({ error: 'captcha must be a signalcaptcha:// URL from signalcaptchas.org' }); return callback(null, resp);
      }
      const numbers = await client.incomingPhoneNumbers.list({ limit: 1 });
      if (!numbers[0]) {
        resp.setStatusCode(400); resp.setBody({ error: 'no incoming phone number found on this Twilio account' }); return callback(null, resp);
      }
      const phone = numbers[0].phoneNumber;
      const syncSid = await ensureSyncService(client, env, vars);
      context.SYNC_SERVICE_SID = syncSid;
      const signal = require(Runtime.getAssets()['/signalOps.js'].path);
      const { persistResult } = await signal.registerPrimary(context, { phone, captcha });
      // Re-registering mints a fresh Signal identity; any prior group memberships
      // are gone. Clear GROUP_KEY so the admin re-picks after re-inviting the bot.
      const gk = vars.find(v => v.key === 'GROUP_KEY');
      if (gk) await env.variables(gk.sid).remove();
      resp.setBody({ ok: true, phone, keystore: persistResult });

    } else if (event.action === 'signal-update-profile') {
      const givenName = (event.givenName || '').trim();
      if (!givenName) { resp.setStatusCode(400); resp.setBody({ error: 'givenName required' }); return callback(null, resp); }
      const syncSid = await ensureSyncService(client, env, vars);
      context.SYNC_SERVICE_SID = syncSid;
      const signal = require(Runtime.getAssets()['/signalOps.js'].path);
      await signal.updateProfile(context, { givenName });
      resp.setBody({ ok: true });

    } else if (event.action === 'signal-list-groups') {
      const signal = require(Runtime.getAssets()['/signalOps.js'].path);
      const groups = await signal.listGroups(context);
      resp.setBody({ groups });

    } else if (event.action === 'signal-download-db') {
      // Reassemble the keystore from Sync and return the raw DB bytes base64-encoded
      // inside JSON. Binary responses through Twilio Functions' Response wrapper are
      // unreliable; base64 is simple and bounded (~4 MB budget fits a typical
      // keystore with room to spare).
      const syncSid = await ensureSyncService(client, env, vars);
      const syncSvc = client.sync.v1.services(syncSid);
      const syncStore = require(Runtime.getAssets()['/syncStore.js'].path);
      const os = require('os');
      const path = require('path');
      const fsMod = require('fs');
      const tmpPath = path.join(os.tmpdir(), `presage-export-${crypto.randomBytes(8).toString('hex')}.db`);
      try {
        const loaded = await syncStore.loadDb(syncSvc, tmpPath);
        const bytes = fsMod.readFileSync(tmpPath);
        console.log(`[signal-download-db] exported ${bytes.length} bytes from slot ${loaded.loadedSlot}`);
        resp.setBody({ ok: true, bytes: bytes.length, dbBase64: bytes.toString('base64') });
      } finally {
        try { fsMod.unlinkSync(tmpPath); } catch { /* ignore */ }
      }

    } else if (event.action === 'signal-upload-db') {
      // Accept a base64-encoded DB and persist it back to Sync. Overwrites
      // whichever slot is authoritative by creating a new slot and flipping.
      const b64 = (event.dbBase64 || '').toString();
      if (!b64) {
        resp.setStatusCode(400); resp.setBody({ error: 'dbBase64 required' }); return callback(null, resp);
      }
      const buf = Buffer.from(b64, 'base64');
      if (buf.length < 4096) {
        resp.setStatusCode(400); resp.setBody({ error: `uploaded DB too small (${buf.length} bytes)` }); return callback(null, resp);
      }
      const syncSid = await ensureSyncService(client, env, vars);
      const syncSvc = client.sync.v1.services(syncSid);
      const syncStore = require(Runtime.getAssets()['/syncStore.js'].path);
      const os = require('os');
      const path = require('path');
      const fsMod = require('fs');
      const tmpPath = path.join(os.tmpdir(), `presage-import-${crypto.randomBytes(8).toString('hex')}.db`);
      try {
        fsMod.writeFileSync(tmpPath, buf);

        // Prune the uploaded DB before chunking it to Sync. Locally-developed
        // DBs typically include avatars, received-message rows, and other
        // cache-only state that we don't need on the send path. Running
        // prune-cache here means the on-Sync footprint stays minimal regardless
        // of what the operator uploaded.
        const child_process = require('child_process');
        const bin = Runtime.getAssets()['/presage-cli.bin'].path;
        const pruneRes = child_process.spawnSync(
          '/bin/ld.so',
          [bin, '--sqlite-db-path', tmpPath, 'prune-cache'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
        if (pruneRes.stderr) {
          for (const line of pruneRes.stderr.split('\n').filter(Boolean)) {
            console.log(`[signal-upload-db prune-cache] ${line}`);
          }
        }
        if (pruneRes.status !== 0) {
          const err = new Error(`prune-cache failed during upload: exit ${pruneRes.status}`);
          err.status = pruneRes.status;
          err.stderr = pruneRes.stderr;
          err.stdout = pruneRes.stdout;
          throw err;
        }
        const prunedBytes = fsMod.statSync(tmpPath).size;

        // Read current meta so persistDb can target the inactive slot / bump revision.
        let prev = null;
        try {
          const metaItem = await syncSvc.documents('keystore-meta').fetch();
          prev = { data: metaItem.data, revision: metaItem.revision };
        } catch (e) {
          if (e.status !== 404) throw e;
        }
        const persistResult = await syncStore.persistDb(syncSvc, tmpPath, prev);
        console.log(`[signal-upload-db] imported ${buf.length} -> pruned ${prunedBytes} bytes into slot ${persistResult.slot}`);
        resp.setBody({ ok: true, uploadedBytes: buf.length, prunedBytes, ...persistResult });
      } finally {
        for (const p of [tmpPath, `${tmpPath}-wal`, `${tmpPath}-shm`, `${tmpPath}-journal`]) {
          try { fsMod.unlinkSync(p); } catch { /* ignore */ }
        }
      }

    } else if (event.action === 'signal-reset-keystore') {
      const syncSid = await ensureSyncService(client, env, vars);
      const syncStore = require(Runtime.getAssets()['/syncStore.js'].path);
      await syncStore.resetKeystore(client.sync.v1.services(syncSid));
      resp.setBody({ ok: true });

    } else if (event.action === 'signal-set-group') {
      const masterKey = (event.masterKey || '').trim();
      if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
        resp.setStatusCode(400); resp.setBody({ error: 'masterKey must be a 64-char hex string' }); return callback(null, resp);
      }
      const v = vars.find(v => v.key === 'GROUP_KEY');
      if (v) await env.variables(v.sid).update({ value: masterKey });
      else await env.variables.create({ key: 'GROUP_KEY', value: masterKey });
      resp.setBody({ ok: true });

    } else {
      resp.setStatusCode(400);
      resp.setBody({ error: 'Unknown action' });
    }
  } catch (err) {
    const dump = {
      action: event.action,
      message: err.message || String(err),
      stack: err.stack,
      stderr: err.stderr ? err.stderr.toString() : undefined,
      stdout: err.stdout ? err.stdout.toString() : undefined,
      status: err.status,
      code: err.code,
      signal: err.signal,
    };
    // Single-line JSON dump: Twilio's log pipeline reliably preserves a single
    // call's first argument, so collapse everything into one structured payload.
    console.error('admin_action_failed ' + JSON.stringify(dump));

    resp.setStatusCode(500);
    resp.setBody({
      error: dump.message,
      action: dump.action,
      stderr: dump.stderr,
      stdout: dump.stdout,
      status: dump.status,
      code: dump.code,
    });
  }

  return callback(null, resp);
};
