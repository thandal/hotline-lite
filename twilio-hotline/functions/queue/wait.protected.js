exports.handler = function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  // Twilio will loop this call while the user is waiting.
  const twiml = new Twilio.twiml.VoiceResponse();
  if (!event.Digits) {
    const gather = twiml.gather({ numDigits: 1 })
    sayLangMap(gather, event.language, messagesMap[event.language].caller.wait.connecting);
    gather.pause({ length: 2 });
    // TODO: Enable this message when voicemail notification is implemented.
    // sayLangMap(gather, event.language, messagesMap[event.language].caller.wait.leaveAMessage);
  } else if (event.Digits == 5) {
    // NOTE: record() isn't supported in waitUrl documents, so we
    // leave() the queue from here to come back to the enqueue verb.
    twiml.leave();
  }
  return callback(null, twiml);
};
