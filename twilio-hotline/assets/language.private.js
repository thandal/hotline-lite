// NOTE: Languages are by default mapped to voices by the Twilio settings here: https://console.twilio.com/us1/develop/voice/settings/text-to-speech
const langToLangLocale = {
  en: 'en-US',
  es: 'es-MX',
};

// This is a TwiML helper function that can be used to say a phone number in a more human-friendly way.
// The twiml object must have a say() sub-verb. Examples include twiml itself, and twiml.gather.
const sayLangMap = function (twiml, lang2, messageMap, phone="") {
  const message = messageMap[lang2].split("{number}");
  for (let i = 0; i < message.length; i++) {
    const say = twiml.say({ language: langToLangLocale[lang2] }, message[i]);
    if (i < message.length - 1) {
      // E.164 to (XXX) XXX-XXXX
      if (phone.length == 12) {
        phone = "(" + phone.slice(2, 5) + ") " + phone.slice(5, 8) + "-" + phone.slice(8, 12);
      } else if (phone.length == 11) {
        phone = "(" + phone.slice(1, 4) + ") " + phone.slice(4, 7) + "-" + phone.slice(7, 11);
      }
      say.sayAs({ "interpret-as": "telephone" }, phone);
    }
  }
}

module.exports = { sayLangMap };
