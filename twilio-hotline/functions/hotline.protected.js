
exports.handler = async function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  const { updateWorkers } = require(Runtime.getAssets()['/updateWorkers.js'].path);
  const languages = context.LANGUAGES.split(',');
  const twiml = new Twilio.twiml.VoiceResponse();
  if (context.BLOCKLIST.split(',').includes(event.From)) {
    twiml.reject()
  } else if (!event.Digits) {
    // Update the workers first
    await updateWorkers(context);
    const gather = twiml.gather({ numDigits: 1 });
    // Say the initial greeting in each language, twice
    for (let n = 0; n < 2; n++) {
      for (let i = 0; i < languages.length; i++) {
        const key = String(i + 1);
        sayLangMap(
          gather,
          languages[i],
          messagesMap[languages[i]].caller.welcome.hello.replace('{number}', key)
        );
        gather.pause({ length: 1 });
      }
      gather.pause({ length: 1 });
    }
    // If no response happens within the gather timeout, say goodbye in the default language and hang up:
    twiml.say(messagesMap[languages[0]].caller.welcome.goodbye);
    twiml.hangup();
  } else if (0 < event.Digits && event.Digits <= languages.length) {
    // NOTE: the dialing instructions in greetingMap *must* be in the order 1, 2, 3, ...
    const key = languages[event.Digits - 1];  // zero-indexed
    console.log("Caller selected language:", key);
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
    twiml.say(messagesMap[languages[0]].caller.welcome.goodbye);
    twiml.hangup();
  }
  return callback(null, twiml);
};
