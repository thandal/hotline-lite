const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const crypto = require('crypto');
const { loadDb, persistDb, resetKeystore } = require(Runtime.getAssets()['/syncStore.js'].path);

// Production loader. For local dev: '/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2'.
const LD = '/bin/ld.so';

function syncService(context) {
  return context.getTwilioClient().sync.v1.services(context.SYNC_SERVICE_SID);
}

// Unique per call: Twilio Functions can run concurrent invocations in the same
// container, so a shared `/tmp/presage.db` would race two SQLite openers.
function tmpDbPath() {
  return path.join(os.tmpdir(), `presage-${crypto.randomUUID()}.db`);
}

// SQLite in WAL mode may leave `<path>-wal` and `<path>-shm` alongside the main
// file. withDb always runs prune-cache, which truncates them, but register does not.
function cleanupTmpDb(dbPath) {
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) {
    try { fs.unlinkSync(p); } catch { /* best effort */ }
  }
}

function runner(_context, dbPath) {
  const bin = Runtime.getAssets()['/presage-cli.bin'].path;
  const base = [bin, '--sqlite-db-path', dbPath];
  return {
    exec: (...subArgs) => {
      const res = child_process.spawnSync(LD, [...base, ...subArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      // Surface presage-cli's stderr to the Function logs even on success — its
      // tracing output is the only window into what happened during sync (decrypt
      // failures, DEM sends, etc).
      if (res.stderr) {
        for (const line of res.stderr.split('\n').filter(Boolean)) {
          console.log(`[presage-cli ${subArgs[0]}] ${line}`);
        }
      }
      if (res.status !== 0) {
        const err = new Error(`presage-cli ${subArgs.join(' ')} exited ${res.status}`);
        err.status = res.status;
        err.stdout = res.stdout;
        err.stderr = res.stderr;
        throw err;
      }
      return res.stdout || '';
    },
    spawn: (...subArgs) =>
      child_process.spawn(LD, [...base, ...subArgs], { stdio: ['pipe', 'pipe', 'pipe'] }),
  };
}

async function withDb(context, { requireExisting = true }, action) {
  const sync = syncService(context);
  const dbPath = tmpDbPath();
  let prev = null;
  if (requireExisting) {
    const loaded = await loadDb(sync, dbPath);
    prev = loaded.prev;
  }
  try {
    const cli = runner(context, dbPath);
    const result = await action(cli);
    // Every presage-cli command except `sync` itself quietly starts receiving in
    // the background, so any operation — even a read like whoami — can leave
    // inbound messages sitting in the local store. Wipe them before the database
    // goes back to Sync, so we never hold a copy of anyone's message. prune-cache
    // clears the message and thread rows (plus avatars and sticker packs) and
    // leaves groups, contacts and key material alone.
    cli.exec('prune-cache');
    const persistResult = await persistDb(sync, dbPath, prev);
    return { result, persistResult };
  } finally {
    cleanupTmpDb(dbPath);
  }
}

// ---- operations ----

async function whoami(context) {
  const { result } = await withDb(context, {}, ({ exec }) => exec('whoami'));
  return result.trim();
}

async function updateProfile(context, { givenName, familyName, about, emoji }) {
  const args = ['update-profile', '--given-name', givenName];
  if (familyName) args.push('--family-name', familyName);
  if (about) args.push('--about', about);
  if (emoji) args.push('--emoji', emoji);
  await withDb(context, {}, ({ exec }) => exec(...args));
  return true;
}

// Lines of `list-groups` stdout, trimmed, no parsing. Each line starts with the
// hex master key followed by a space and whatever formatting presage chose.
function splitGroupLines(out) {
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Reads registration info, local group list, and own profile in a single DB round-trip.
// profile fetch is isolated: a Signal-server hiccup shouldn't break status rendering.
// whoami and list-groups are treated as core — if they fail, the whole call fails.
async function statusBundle(context) {
  const { result } = await withDb(context, {}, async ({ exec }) => {
    const whoami = exec('whoami').trim();
    const groups = exec('list-groups');
    let profile = null;
    try { profile = exec('retrieve-profile-self'); }
    catch (e) { console.warn('[statusBundle] retrieve-profile-self failed:', e.message); }
    return { whoami, groups, profile };
  });
  let profile = {};
  if (result.profile) {
    try { profile = JSON.parse(result.profile); } catch { /* leave empty */ }
  }
  return {
    whoami: result.whoami,
    groupLines: splitGroupLines(result.groups),
    profile,
  };
}

// Auto-reply body sent during the listGroups sync. Hardcoded on the
// refresh-group-list path so any inbound 1:1 message gets a reply (which also
// re-establishes a session if the sender's was stale). The hotline phone
// number is interpolated from `HOTLINE_PHONE_NUMBER` (the same env var used
// for outbound SMS in queue/assignment.protected.js).
function autoReplyMessage(context) {
  const phone = (context.HOTLINE_PHONE_NUMBER || '').trim();
  const callTo = phone ? ` at ${phone}` : '';
  return `Hi! This account is automated and only sends hotline notifications. To reach a human, please call the hotline directly${callTo}.`;
}

async function listGroups(context) {
  const reply = autoReplyMessage(context);
  const { result } = await withDb(context, {}, ({ exec }) => {
    exec('sync', '--stop-after-empty-queue', '--auto-reply', reply);
    return exec('list-groups');
  });
  return splitGroupLines(result);
}

async function sendToGroup(context, { message, attachment_path = null }) {
  await withDb(context, {}, ({ exec }) => {
    exec('sync', '--stop-after-empty-queue');
    const args = ['send-to-group', '--master-key', context.GROUP_KEY, '--message', message];
    if (attachment_path) args.push('--attach', attachment_path);
    exec(...args);
  });
  return true;
}


// ---- registration (bootstrap) ----

// Waits for a verification SMS to land in the Twilio account's inbound message log
// (Signal sends verification codes via SMS; the Twilio-owned number receives them).
// Returns the 6-digit code as a string. Times out after `maxSeconds`.
async function pollForSignalSms(context, afterDate, maxSeconds) {
  const client = context.getTwilioClient();
  const deadline = Date.now() + maxSeconds * 1000;
  const pattern = /Signal[^0-9]{0,40}(\d{3})[-\s]?(\d{3})/i;
  while (Date.now() < deadline) {
    const messages = await client.messages.list({ dateSentAfter: afterDate, limit: 20 });
    for (const msg of messages) {
      if (!msg.body) continue;
      const m = msg.body.match(pattern);
      if (m) return m[1] + m[2];
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Signal verification SMS did not arrive within ${maxSeconds}s`);
}

async function registerPrimary(context, { phone, captcha, smsWaitSeconds = 7 }) {
  console.log(`[signal-register] start phone=${phone}`);
  const sync = syncService(context);
  const dbPath = tmpDbPath();
  cleanupTmpDb(dbPath);

  const startedAt = new Date(Date.now() - 15 * 1000);
  const { spawn } = runner(context, dbPath);
  const proc = spawn('register', '--force', '--servers', 'production', '--phone-number', phone, '--captcha', captcha);

  let stderr = '';
  let procExited = false;
  proc.stderr.on('data', (d) => (stderr += d.toString()));
  proc.stdout.on('data', () => { /* drain, otherwise pipe fills and blocks the child */ });
  proc.on('exit', () => { procExited = true; });
  // Node treats an unhandled EPIPE/EIO on the stdin stream as an async error;
  // handle it so the process doesn't crash when we write to a dead child.
  proc.stdin.on('error', (err) => console.warn('[signal-register] stdin error:', err.message));

  const earlyExit = new Promise((_, reject) => {
    proc.on('exit', (c) => {
      if (c !== 0) reject(new Error(`presage-cli register exited ${c} before code was provided:\n${stderr}`));
    });
    proc.on('error', reject);
  });

  let code;
  try {
    console.log('[signal-register] waiting for SMS and/or early exit');
    code = await Promise.race([
      pollForSignalSms(context, startedAt, smsWaitSeconds),
      earlyExit,
    ]);
    console.log('[signal-register] got verification code (masked)');
  } catch (err) {
    try { proc.kill('SIGKILL'); } catch { /* proc may already be gone */ }
    cleanupTmpDb(dbPath);
    err.stderr = stderr;
    throw err;
  }

  if (procExited) {
    const err = new Error(`presage-cli exited before accepting confirmation code:\n${stderr}`);
    err.stderr = stderr;
    cleanupTmpDb(dbPath);
    throw err;
  }

  try {
    proc.stdin.write(code + '\n');
    proc.stdin.end();
  } catch (err) {
    cleanupTmpDb(dbPath);
    err.stderr = stderr;
    throw err;
  }

  await new Promise((resolve, reject) => {
    proc.on('exit', (c) => {
      if (c === 0) resolve();
      else {
        const err = new Error(`presage-cli register exited ${c}:\n${stderr}`);
        err.stderr = stderr;
        reject(err);
      }
    });
    proc.on('error', reject);
  });
  console.log('[signal-register] presage exited OK; wiping prior keystore then persisting fresh');

  // Register is explicitly a bootstrap operation — we've just minted a new Signal
  // identity and the local DB at `dbPath` is the source of truth. Wipe any prior
  // keystore state in Sync so old orphan chunks / stale slot info can't survive
  // across re-registers, then persist the new keystore fresh.
  try {
    await resetKeystore(sync);
  } catch (err) {
    console.warn('[signal-register] resetKeystore before persist failed (continuing):', err.message);
  }

  // register fetches initial messages after uploading pre-keys, and it runs outside
  // withDb, so prune here too before the fresh keystore goes to Sync. Best effort,
  // like resetKeystore above: a brand new identity has next to nothing to prune, and
  // failing here would strand a registration that already succeeded.
  try {
    runner(context, dbPath).exec('prune-cache');
  } catch (err) {
    console.warn('[signal-register] prune-cache before persist failed (continuing):', err.message);
  }

  const persistResult = await persistDb(sync, dbPath, null);
  cleanupTmpDb(dbPath);
  console.log(`[signal-register] done: ${JSON.stringify(persistResult)}`);
  return { persistResult };
}

module.exports = {
  whoami,
  statusBundle,
  updateProfile,
  listGroups,
  sendToGroup,
  registerPrimary,
  pollForSignalSms,
};
