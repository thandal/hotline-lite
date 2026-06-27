
exports.handler = async function (context, event, callback) {
  const { langMap, sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  const { updateWorkers } = require(Runtime.getAssets()['/updateWorkers.js'].path);
  const languages = context.LANGUAGES.split(',');
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
  // then send the keys that connect the caller.
  if (!event.Digits && callerSequence) {
    if (callerSequence.pause) {
      twiml.say('Hello.');
      twiml.pause({ length: parseInt(callerSequence.pause, 10) || 0 });
    }
    if (callerSequence.sequence) {
      twiml.play({ digits: callerSequence.sequence });
    }
  }

  if (!event.Digits && languages.length > 1) {
    // Update the workers first
    await updateWorkers(context);
    const gather = twiml.gather({ numDigits: 1 });
    // Say the initial greeting in each language, twice
    for (let n = 0; n < 2; n++) {
      for (let i = 0; i < languages.length; i++) {
        const key = String(i + 1);
        gather.say({ language: langMap[languages[i]].locale, voice: langMap[languages[i]].voice }, messagesMap[languages[i]].caller.welcome.hello.replace('{name}', hotlineName[i]));
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
    twiml.say({ language: langMap[languages[0]].locale, voice: langMap[languages[0]].voice }, messagesMap[languages[0]].caller.welcome.goodbye);
    twiml.hangup();
  } else if ((0 < event.Digits && event.Digits <= languages.length) || languages.length == 1) {
    var key = languages[0];
    if (languages.length == 1) {
      // No language selection needed if there is just one language!
      twiml.say({ language: langMap[key].locale, voice: langMap[key].voice }, messagesMap[key].caller.welcome.hello.replace('{name}', hotlineName[0]));
    } else {
      // NOTE: the dialing instructions in greetingMap *must* be in the order 1, 2, 3, ...
      key = languages[event.Digits - 1];  // zero-indexed
      console.log("Caller selected language:", key);
    }
    twiml.enqueue({
      workflowSid: context.WORKFLOW_SID,
      // Have to pass the language as a parameter because the Task
      // attributes aren't passed along to the wait callback... UGH!
      waitUrl: '/queue/wait?language=' + key,
      // Maybe record a message, depending on the QueueResult
      action: '/record?language=' + key + '&callerFrom=' + encodeURIComponent(event.From),
    }).task({}, JSON.stringify({ language: key }));
    twiml.hangup();
  } else {
    twiml.say({ language: langMap[languages[0]].locale, voice: langMap[languages[0]].voice }, messagesMap[languages[0]].caller.welcome.goodbye);
    twiml.hangup();
  }
  return callback(null, twiml);
};
