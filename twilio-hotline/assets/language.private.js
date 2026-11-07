// This object maps supported languages to their locale and voice information:
// lang_code: { locale: 'locale-code', name: 'Language Name', voice: 'voice-id' }
//
// Without an explicit `voice`, Twilio uses the account-level default for the
// locale (configurable in the console at
// https://console.twilio.com/us1/develop/voice/settings/text-to-speech), which
// for most languages is a low-quality, choppy "standard" voice. Setting a voice
// here gives every deployment a good caller experience without per-account
// setup. Languages omitted here fall back to that locale default.
//
// Voices are Twilio voice identifiers (https://www.twilio.com/docs/voice/twiml/say/text-speech).
// These are Amazon Polly "Neural" voices — a good quality/cost balance; swap in
// Polly "-Generative" or "Google.<locale>-Chirp3-HD-*" voices for the most
// natural output. Languages with no voice in their own language (ht, ku, ti,
// sw, uk, rw, ru, am, fa, vi) are left to the locale default rather than being
// read aloud by a voice from an unrelated language.
const langMap = {
  // no compatible voice identified - am: { locale: 'am-ET', name: 'Amharic' }, // will Google.am-ET-Wavenet-A work?
  // not supported - ar: { locale: 'ar-IQ', name: 'Arabic', voice: 'Polly.Hala-Neural' }, // ar-AE (Gulf Arabic; nearest neural voice to ar-IQ)
  en: { locale: 'en-US', name: 'English', voice: 'Polly.Joanna-Neural' },
  es: { locale: 'es-MX', name: 'Spanish', voice: 'Polly.Mia-Neural' },
  // not supported - fa_af: { locale: 'fa-AF', name: 'Dari' }, // Distinct from Farsi (fa-IR); will Polly.Hala-Neural work?
  // not supported - fa_ir: { locale: 'fa-IR', name: 'Farsi' }, // Distinct from Dari (fa-AF); will Polly.Hala-Neural work?
  fr: { locale: 'fr-FR', name: 'French', voice: 'Polly.Lea-Neural' },
  // no compatible voice identified - ht: { locale: 'ht-HT', name: 'Haitian Creole' }, // will Google.ht-HT-Wavenet-A work?
  // no compatible voice identified - ku: { locale: 'ku-IQ', name: 'Kurdish' }, // will Google.ku-IQ-Wavenet-A work?
  // not supported - pt: { locale: 'pt-BR', name: 'Portuguese', voice: 'Polly.Camila-Neural' },
  // not supported - ru: { locale: 'ru-RU', name: 'Russian', voice: 'Google.ru-RU-Wavenet-A' },
  // no compatible voice identified - rw: { locale: 'rw-RW', name: 'Kinyarwanda' }, // will Google.rw-RW-Wavenet-A work?
  // no compatible voice identified - sw: { locale: 'sw-KE', name: 'Swahili' }, // will Google.sw-KE-Wavenet-A work?
  // no compatible voice identified - ti: { locale: 'ti-ET', name: 'Tigrinya' }, // will Google.ti-ET-Wavenet-A work?
  // not supported - uk: { locale: 'uk-UA', name: 'Ukrainian', voice: 'uk-UA-Chirp3-HD-Achernar' }, // No Ukrainina Neural voice, so using Google Generative voice (Chirp3-HD) instead of Polly Standard voice
  // not supported - vi: { locale: 'vi-VN', name: 'Vietnamese', voice: 'Google.vi-VN-Wavenet-A' },
  // not supported - zh: { locale: 'zh-CN', name: 'Mandarin', voice: 'Polly.Zhiyu-Neural' },
};

// Build the attributes object for a TwiML <Say>: always sets the language
// locale, and adds the configured voice when one exists for the language.
const sayAttrs = function (lang2) {
  const attrs = { language: langMap[lang2].locale };
  if (langMap[lang2].voice) attrs.voice = langMap[lang2].voice;
  return attrs;
};

const formatE164 = function (phone) {
  // E.164 to (XXX) XXX-XXXX
  let formattedPhone = phone;
  if (phone.length == 12) {
    formattedPhone = "(" + phone.slice(2, 5) + ") " + phone.slice(5, 8) + "-" + phone.slice(8, 12);
  } else if (phone.length == 11) {
    formattedPhone = "(" + phone.slice(1, 4) + ") " + phone.slice(4, 7) + "-" + phone.slice(7, 11);
  }
  return formattedPhone;
}

// This is a TwiML helper function that can be used to say a phone number in a more human-friendly way.
// The twiml object must have a say() sub-verb. Examples include twiml itself, and twiml.gather.
const sayLangMap = function (twiml, lang2, message, phone = "") {
  const messageParts = message.split("{phone number}");
  for (let i = 0; i < messageParts.length; i++) {
    const say = twiml.say(sayAttrs(lang2), messageParts[i]);
    if (i < messageParts.length - 1) {
      const formattedPhone = formatE164(phone);
      say.sayAs({ "interpret-as": "telephone" }, formattedPhone);
    }
  }
}

// This is a helper function that loads the message files for the requested languages.
// It returns an object mapping language codes to the message objects.
//
// The message objects contain placeholders, filled in by the code that speaks each message:
//   {hotline name}  the hotline's name in this language (HOTLINE_NAME, or `name` below)
//   {key}           the key to press for this language in the language menu
//   {caller name}   the name given to the caller's number in Special Call Handling
//   {phone number}  the caller's phone number, read out digit by digit
//
// A language can be offered on the hotline only once it has every message
// below (see supportedLanguages at the end of this file).
const loadMessages = function (languages) {
  return Object.fromEntries(languages.map(lang => supportedLanguages.includes(lang) ?
    [lang, require(Runtime.getAssets()[`/messages/${lang}.js`].path)] : null
  ).filter(Boolean));
};

// The languages the hotline can offer, in menu-list order: those with both a
// locale above and a full set of messages. langMap also lists languages with
// no messages yet, so the dashboard and the admin API check against this list.
const supportedLanguages = Object.keys(langMap)
  .filter(lang => Object.keys(Runtime.getAssets()).includes(`/messages/${lang}.js`));

module.exports = { langMap, sayAttrs, sayLangMap, loadMessages, formatE164, supportedLanguages };
