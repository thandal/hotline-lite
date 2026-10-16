
exports.handler = async function (context, event, callback) {
  const { sayAttrs, sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  const { updateWorkers, languageHasOperator } = require(Runtime.getAssets()['/updateWorkers.js'].path);
  // LANGUAGES is dashboard-managed and may be unset on a fresh install (before an
  // admin configures one) or cleared to empty; fall back to a default so the
  // greeting still works, mirroring the guards on BLOCKLIST/CONNECTION_SEQUENCES below.
  const languages = (context.LANGUAGES || 'es,en').split(',');
  const hotlineName = (context.HOTLINE_NAME) ? context.HOTLINE_NAME.split(',') : languages.map(x => messagesMap[x].name);
  const twiml = new Twilio.twiml.VoiceResponse();

  // Special call handling. Callers arriving through a collect-call gateway need
  // a key sequence played to accept the call and connect them; the same list of
  // numbers doubles as an allowlist when ALLOWLIST_ONLY is enabled.
  let connectionSequences = [];
  try { connectionSequences = JSON.parse(context.CONNECTION_SEQUENCES || '[]'); }
  catch (e) { connectionSequences = []; }
  if (!Array.isArray(connectionSequences)) connectionSequences = [];
  const allowlistOnly = context.ALLOWLIST_ONLY === 'true';
  const callerSequence = connectionSequences.find(s => s && s.number === event.From);
  // An entry may set a language, which skips the language menu for that number.
  // Ignore it once that language is no longer offered; the caller gets the menu.
  const presetLanguage = callerSequence && languages.includes(callerSequence.language)
    ? callerSequence.language : null;

  // BLOCKLIST may be unset (it isn't pre-provisioned), empty, or the 'null'
  // sentinel admin writes for an empty list — guard the split so a missing var
  // can't crash every call.
  const blocklist = (!context.BLOCKLIST || context.BLOCKLIST === 'null')
    ? [] : context.BLOCKLIST.split(',').filter(Boolean);

  if (blocklist.includes(event.From) || (allowlistOnly && !callerSequence)) {
    twiml.reject();
    return callback(null, twiml);
  }

  // On the first inbound request (before any language digit), play the accept
  // sequence for a collect-call gateway: greet, wait for the system's prompt,
  // then send the keys that connect the caller. Both halves are optional: an
  // entry with no sequence is only allow-listed (no gateway), so there is
  // nothing to play, and an entry with no pause needs no prompt to wait for.
  if (!event.Digits && callerSequence) {
    if (callerSequence.pause) {
      twiml.say('Hello.');
      twiml.pause({ length: parseInt(callerSequence.pause, 10) || 0 });
    }
    if (callerSequence.sequence) {
      twiml.play({ digits: callerSequence.sequence });
    }
  }

  if (!event.Digits) {
    // Update the workers first. Worker sync is a best-effort refresh, never a
    // gate on the call: if it throws, TaskRouter still holds the roster from the
    // last successful sync, so answer the caller and let the error surface in the
    // logs rather than dropping them.
    try {
      await updateWorkers(context);
    } catch (e) {
      console.error('update_workers_failed ' + (e.message || e));
    }
  }

  const playMenu = function () {
    // Post the digit to /hotline itself rather than to "the current URL": when
    // /queue/wait sends a caller back here as /hotline?Digits=0, the current
    // URL would carry that stale digit along with the new one.
    const gather = twiml.gather({ numDigits: 1, action: '/hotline' });
    // Say the initial greeting in each language, twice
    for (let n = 0; n < 2; n++) {
      for (let i = 0; i < languages.length; i++) {
        const key = String(i + 1);
        gather.say(sayAttrs(languages[i]), messagesMap[languages[i]].caller.welcome.hello.replace('{name}', hotlineName[i]));
        sayLangMap(
          gather,
          languages[i],
          messagesMap[languages[i]].caller.welcome.menu.replace('{number}', key)
        );
        gather.pause({ length: 1 });
      }
      gather.pause({ length: 1 });
    }
    // If no response happens within the gather timeout, say goodbye in the default language and hang up:
    twiml.say(sayAttrs(languages[0]), messagesMap[languages[0]].caller.welcome.goodbye);
    twiml.hangup();
  };

  // A preset language only applies to the first request. Digits mean the
  // caller has been through the menu (or asked for it by pressing 0 on hold,
  // see /queue/wait), and then their choice wins over the preset.
  const skipMenu = (presetLanguage && !event.Digits) || languages.length == 1;
  if (!event.Digits && !skipMenu) {
    playMenu();
  } else if (skipMenu || (0 < event.Digits && event.Digits <= languages.length)) {
    let key;
    if (skipMenu) {
      key = presetLanguage || languages[0];
      // No menu, so this is the caller's only greeting.
      twiml.say(sayAttrs(key), messagesMap[key].caller.welcome.hello.replace('{name}', hotlineName[languages.indexOf(key)]));
    } else {
      // NOTE: the dialing instructions in greetingMap *must* be in the order 1, 2, 3, ...
      key = languages[event.Digits - 1];  // zero-indexed
      console.log("Caller selected language:", key);
    }
    // The call is queued even when nobody on call speaks the language, so an
    // operator who comes on call can still take it; the flag only changes the
    // hold message so the caller isn't left waiting for no one.
    const hasOperator = await languageHasOperator(context, key);
    if (!hasOperator) console.log("No on-call operator speaks", key);
    // The entry's name goes on the task so preCall can announce it to the operator.
    twiml.enqueue({
      workflowSid: context.WORKFLOW_SID,
      // Have to pass the language as a parameter because the Task
      // attributes aren't passed along to the wait callback... UGH!
      waitUrl: '/queue/wait?language=' + key + (hasOperator ? '' : '&noOperators=1'),
      // Maybe record a message, depending on the QueueResult
      action: '/record?language=' + key + '&callerFrom=' + encodeURIComponent(event.From),
    }).task({}, JSON.stringify({ language: key, callerName: (callerSequence && callerSequence.name) || '' }));
    twiml.hangup();
  } else {
    // A key that matches no language, or the 0 that /queue/wait relays when a
    // caller on hold asks for another language: play the menu again. Replay it
    // here rather than redirecting to /hotline, which would take the call for a
    // new one and send a gateway's key sequence into the live call a second time.
    playMenu();
  }
  return callback(null, twiml);
};
