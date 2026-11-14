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
  ar: { locale: 'ar-IQ', name: 'Arabic', voice: 'Polly.Hala-Neural' }, // ar-AE (Gulf Arabic; nearest neural voice to ar-IQ)
  en: { locale: 'en-US', name: 'English', voice: 'Polly.Joanna-Neural' },
  es: { locale: 'es-MX', name: 'Spanish', voice: 'Polly.Mia-Neural' },
  fa_af: { locale: 'fa-AF', name: 'Dari' }, // Distinct from Farsi (fa-IR); will Polly.Hala-Neural work?
  fa_ir: { locale: 'fa-IR', name: 'Farsi' }, // Distinct from Dari (fa-AF); will Polly.Hala-Neural work?
  fr: { locale: 'fr-FR', name: 'French', voice: 'Polly.Lea-Neural' },
  // no compatible voice identified - ht: { locale: 'ht-HT', name: 'Haitian Creole' }, // will Google.ht-HT-Wavenet-A work?
  // no compatible voice identified - ku: { locale: 'ku-IQ', name: 'Kurdish' }, // will Google.ku-IQ-Wavenet-A work?
  // no compatible voice identified - ne: { locale: 'ne-NP', name: 'Nepali' }, // will Google.ne-NP-Wavenet-A work?
  pt: { locale: 'pt-BR', name: 'Portuguese', voice: 'Polly.Camila-Neural' },
  ru: { locale: 'ru-RU', name: 'Russian', voice: 'Google.ru-RU-Wavenet-A' },
  // no compatible voice identified - rw: { locale: 'rw-RW', name: 'Kinyarwanda' }, // will Google.rw-RW-Wavenet-A work?
  // no compatible voice identified - sw: { locale: 'sw-KE', name: 'Swahili' }, // will Google.sw-KE-Wavenet-A work?
  // no compatible voice identified - ti: { locale: 'ti-ET', name: 'Tigrinya' }, // will Google.ti-ET-Wavenet-A work?
  uk: { locale: 'uk-UA', name: 'Ukrainian', voice: 'uk-UA-Chirp3-HD-Achernar' }, // No Ukrainina Neural voice, so using Google Generative voice (Chirp3-HD) instead of Polly Standard voice
  vi: { locale: 'vi-VN', name: 'Vietnamese', voice: 'Google.vi-VN-Wavenet-A' },
  zh: { locale: 'zh-CN', name: 'Mandarin', voice: 'Polly.Zhiyu-Neural' },
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

// Each language's phone messages are in assets/messages/<code>.private.json,
// which Twilio serves as the private asset /messages/<code>.json. Undefined
// when the language has no message file.
const messageFile = lang => Runtime.getAssets()[`/messages/${lang}.json`];

// Loads the messages for the requested languages that have a message file.
// It returns an object mapping language codes to the message objects.
//
// The messages contain placeholders, filled in by the code that speaks each message:
//   {hotline name}  the hotline's name in this language (HOTLINE_NAME, or the file's `name`)
//   {key}           the key to press for this language in the language menu
//   {caller name}   the name given to the caller's number in Special Call Handling
//   {phone number}  the caller's phone number, read out digit by digit
//
// This loads a language even when its file lacks some messages, so a language
// already on the hotline keeps answering calls if one of its messages is lost;
// supportedLanguages below keeps such a language from being added.
const loadMessages = function (languages) {
  return Object.fromEntries(languages.filter(messageFile)
    .map(lang => [lang, require(messageFile(lang).path)]));
};

// The dotted path of every message in a messages object, e.g. "caller.wait.connecting".
// Blank messages are left out, so they count as missing.
const messagePaths = function (messages, prefix = '') {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === 'object' ? messagePaths(value, prefix + key + '.')
      : typeof value === 'string' && value.trim() ? [prefix + key] : []);
};

// The languages the hotline can offer, in menu-list order: those with a locale
// above and a message file holding every message the English file has (English
// is the reference, so en.private.json must exist). The dashboard and the admin
// API only let an admin add languages from this list. A file missing messages
// is left out, so a partial translation is never offered; it is logged as a
// warning and listed in incompleteLanguages (code -> the missing messages'
// paths), which the dashboard shows to admins.
const englishPaths = messagePaths(loadMessages(['en']).en);
const incompleteLanguages = {};
const supportedLanguages = Object.keys(langMap).filter(lang => {
  if (!messageFile(lang)) return false;
  const paths = messagePaths(loadMessages([lang])[lang]);
  const missing = englishPaths.filter(p => !paths.includes(p));
  if (missing.length) {
    incompleteLanguages[lang] = missing;
    console.warn(`Not offering ${lang}: its message file lacks ${missing.join(', ')}`);
  }
  return missing.length == 0;
});

module.exports = { langMap, sayAttrs, sayLangMap, loadMessages, formatE164, supportedLanguages, incompleteLanguages };
