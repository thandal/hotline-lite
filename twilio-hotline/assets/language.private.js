// lang2 -> [locale, display name].
const langToLangLocale = {
  en: ['en-US', 'English'],
  es: ['es-MX', 'Spanish'],
  fr: ['fr-FR', 'French'],
  pt: ['pt-BR', 'Portuguese'],
  ht: ['ht-HT', 'Haitian Creole'],
  zh: ['zh-CN', 'Chinese'],
  ar: ['ar-IQ', 'Arabic'],
  ku: ['ku-IQ', 'Kurdish'],
  ti: ['ti-ET', 'Tigrinya'],
  sw: ['sw-KE', 'Swahili'],
  uk: ['uk-UA', 'Ukrainian'],
  rw: ['rw-RW', 'Kinyarwanda'],
  ru: ['ru-RU', 'Russian'],
  am: ['am-ET', 'Amharic'],
  fa: ['fa-AF', 'Dari'],
  vi: ['vi-VN', 'Vietnamese'],
};

// Default text-to-speech voice per language. Without an explicit voice, Twilio
// uses the account-level default for the locale (configurable in the console at
// https://console.twilio.com/us1/develop/voice/settings/text-to-speech), which
// for most languages is a low-quality, choppy "standard" voice. Setting a voice
// here gives every deployment a good caller experience without per-account
// setup. Languages omitted here fall back to that locale default.
//
// Values are Twilio voice identifiers (https://www.twilio.com/docs/voice/twiml/say/text-speech).
// These are Amazon Polly "Neural" voices — a good quality/cost balance; swap in
// Polly "-Generative" or "Google.<locale>-Chirp3-HD-*" voices for the most
// natural output. Languages with no high-quality Twilio voice (ht, ku, ti, sw,
// uk, rw, ru, am, fa, vi) are left to the locale default for now.
const langToVoice = {
  en: 'Polly.Joanna-Neural',   // en-US
  es: 'Polly.Mia-Neural',      // es-MX
  fr: 'Polly.Lea-Neural',      // fr-FR
  pt: 'Polly.Camila-Neural',   // pt-BR
  zh: 'Polly.Zhiyu-Neural',    // cmn-CN (Mandarin)
  ar: 'Polly.Hala-Neural',     // ar-AE (Gulf Arabic; nearest neural voice to ar-IQ)
};

// Build the attributes object for a TwiML <Say>: always sets the language
// locale, and adds the configured voice when one exists for the language.
const sayAttrs = function (lang2) {
  const attrs = { language: langToLangLocale[lang2][0] };
  if (langToVoice[lang2]) attrs.voice = langToVoice[lang2];
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
  const messageParts = message.split("{number}");
  for (let i = 0; i < messageParts.length; i++) {
    const say = twiml.say(sayAttrs(lang2), messageParts[i]);
    if (i < messageParts.length - 1) {
      const formattedPhone = formatE164(phone);
      say.sayAs({ "interpret-as": "telephone" }, formattedPhone);
    }
  }
}

const messagesMap = {
  en: {
    name: "the community hotline",
    caller: {
      welcome: {
        hello: "Thank you for calling {name}.",
        menu: "Press {number} for English.",
        goodbye: "Goodbye.",
      },
      wait: {
        connecting: "Someone will be with you shortly.",
        leaveAMessage: "Please remain on the line, or press 5 to leave a message.",
      },
      record: {
        prompt: "Please leave a message after the tone.",
      }
    },
    operator: {
      precall: {
        intro: "This is a call from {name}. Press any key to accept the call.",
        noResponse: "You didn't respond, so we're moving on to another operator. This call was from {number}.",
        reservationStatus: {
          rescinded: "Another operator answered this call.",
          canceled: "The caller hung up.",
          default: "Someone else answered or the caller hung up.",
        }
      },
      postcall: {
        options: "Call finished. Press 1 to repeat the caller's number. Press 2 to add the caller to the blocklist. Press 3 to call the caller back.",
        callerNumber: "This call was from {number}.",
        blocking: "Blocking calls from {number}.",
        callingBack: "Calling {number}.",
      }
    }
  },
  es: {
    name: "la linea directa comunitaria",
    caller: {
      welcome: {
        hello: "Gracias por llamar a {name}.",
        menu: "Presione {number} para español.",
        goodbye: "Cuídese.",
      },
      wait: {
        connecting: "Alguien estará con usted en breve.",
        leaveAMessage: "Por favor, permanezca en la línea o presione 5 para dejar un mensaje.",
      },
      record: {
        prompt: "Por favor, deje un mensaje después del tono.",
      }
    },
    operator: {
      precall: {
        intro: "Esta es una llamada de {name}. Presione cualquier tecla para aceptar la llamada.",
        noResponse: "No respondió, así que pasamos a otro operador. Esta llamada era de {number}.",
        reservationStatus: {
          rescinded: "Otre operador respondió a esta llamada.",
          canceled: "La persona en espera terminó la llamada.",
          default: "La llamada se finalizó.",
        }
      },
      postcall: {
        options: "Llamada finalizada. Presione 1 para escuchar el número de nuevo. Presione 2 para bloquearlo. Presione 3 para marcarlo de nuevo.",
        callerNumber: "Esta llamada era de {number}.",
        blocking: "Se bloquearon llamadas de {number}.",
        callingBack: "Marcando {number}.",
      }
    }
  }
};

const ES_MESSAGES = messagesMap.es;
const EN_MESSAGES = messagesMap.en;

module.exports = { langToLangLocale, sayAttrs, sayLangMap, messagesMap, formatE164 };
