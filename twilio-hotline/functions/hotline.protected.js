exports.handler = async function (context, event, callback) {
  const { sayLangMap } = require(Runtime.getAssets()['/language.js'].path);
  const { updateWorkers } = require(Runtime.getAssets()['/updateWorkers.js'].path);
  const greetingMap = {
    es: 'Gracias por llamar a la línea directa comunitaria. Presione 1 para español...',
    en: 'Thanks for calling the community hotline. Press 2 for english...',
  };
  const twiml = new Twilio.twiml.VoiceResponse();
  if (context.BLOCKLIST.split(',').includes(event.From)) {
    twiml.reject()
  } else if (!event.Digits) {
    await updateWorkers(context);
    const gather = twiml.gather({ numDigits: 1 });
    for (const key in greetingMap) {
      sayLangMap(gather, key, greetingMap);
      gather.pause({ length: 1 });
    }
    gather.pause({ length: 1 });
    // Do it again!
    for (const key in greetingMap) {
      sayLangMap(gather, key, greetingMap);
      gather.pause({ length: 1 });
    }
    // If no response happens within the gather timeout:
    twiml.say('Goodbye.');
    twiml.hangup();
  } else if (0 < event.Digits && event.Digits <= Object.keys(greetingMap).length) {
    // NOTE: the dialing instructions in greetingMap *must* be in the order 1, 2, 3, ...
    const key = Object.keys(greetingMap)[event.Digits - 1];  // zero-indexed
    twiml.enqueue({
      workflowSid: context.WORKFLOW_SID,
      // Have to pass the language as a parameter because the Task
      // attributes aren't passed along to the wait callback... UGH!
      waitUrl: '/queue/wait?language=' + key,
      // Maybe record a message, depending on the QueueResult
      action: '/record?language=' + key + '&callerFrom=' + encodeURIComponent(event.From),
    })
      .task({}, JSON.stringify({ language: key }));
    twiml.hangup();
  } else {
    twiml.say('Goodbye.');
    twiml.hangup();
  }
  return callback(null, twiml);
};
