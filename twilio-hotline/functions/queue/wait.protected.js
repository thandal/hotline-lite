exports.handler = function (context, event, callback) {
  const { sayLangMap, loadMessages } = require(Runtime.getAssets()['/language.js'].path);
  const messages = loadMessages([event.language])[event.language].caller.wait;
  // Voice memos are delivered over Signal; without an active group (GROUP_KEY)
  // a recording would go nowhere, so don't offer to take one.
  const signalConfigured = !!context.GROUP_KEY;
  // Twilio will loop this call while the user is waiting.
  const twiml = new Twilio.twiml.VoiceResponse();
  if (!event.Digits) {
    if (signalConfigured) {
      const gather = twiml.gather({ numDigits: 1 })
      sayLangMap(gather, event.language, messages.connecting);
      gather.pause({ length: 2 });
      sayLangMap(gather, event.language, messages.leaveAMessage);
    } else {
      sayLangMap(twiml, event.language, messages.connecting);
      twiml.pause({ length: 2 });
    }
  } else if (event.Digits == 5 && signalConfigured) {
    // NOTE: record() isn't supported in waitUrl documents, so we
    // leave() the queue from here to come back to the enqueue verb.
    twiml.leave();
  }
  return callback(null, twiml);
};
