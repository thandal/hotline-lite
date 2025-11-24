exports.handler = function (context, event, callback) {
  const { sayLangMap } = require(Runtime.getAssets()['/language.js'].path);
  // Twilio will loop this call while the user is waiting.
  const connectingMap = {
    en: 'Someone will be with you shortly.',
    es: 'Alguien le attenderá en breve.',
  };
  const remainMap = {
    en: 'Please remain on the line.',
    es: 'Por favor espere en línea.',
  };
  const optionMap = {
    en: 'Please continue to wait, or press 5 to leave a message.',
    es: 'Por favor continúe esperando, o presione 5 para dejar un mensaje.',
  };
  const twiml = new Twilio.twiml.VoiceResponse();
  if (!event.Digits) {
    const gather = twiml.gather({ numDigits: 1 })
    sayLangMap(gather, event.language, connectingMap);
    gather.pause({ length: 2 });
    sayLangMap(gather, event.language, remainMap);
    gather.pause({ length: 2 });
    sayLangMap(gather, event.language, optionMap);
  } else if (event.Digits == 5) {
    // NOTE: record() isn't supported in waitUrl documents, so we
    // leave() the queue from here to come back to the enqueue verb.
    twiml.leave();
  }
  return callback(null, twiml);
};
