const crypto = require('crypto');

function token(context, salt) {
  return crypto.createHmac('sha1', context.AUTH_TOKEN)
    .update(context.ACCOUNT_SID + context.ADMIN_PASSWORD + salt)
    .digest('hex');
}

const fs = require('fs');

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
      resp.setBody({ operators, blocklist, languages });

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

    } else if (event.action === 'dashboard') {
      const dashPath = Runtime.getAssets()['/dashboard.html'].path;
      resp.setBody({ html: fs.readFileSync(dashPath, 'utf8') });

    } else {
      resp.setStatusCode(400);
      resp.setBody({ error: 'Unknown action' });
    }
  } catch (err) {
    resp.setStatusCode(500);
    resp.setBody({ error: err.message });
  }

  return callback(null, resp);
};
