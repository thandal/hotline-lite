// lang2 -> {locale, display name, optional text-to-speech voice}.
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
  en: { locale: 'en-US', name: 'English', voice: 'Polly.Joanna-Neural' },
  es: { locale: 'es-MX', name: 'Spanish', voice: 'Polly.Mia-Neural' },
  fr: { locale: 'fr-FR', name: 'French', voice: 'Polly.Lea-Neural' },
  pt: { locale: 'pt-BR', name: 'Portuguese', voice: 'Polly.Camila-Neural' },
  ht: { locale: 'ht-HT', name: 'Haitian Creole' },
  zh: { locale: 'zh-CN', name: 'Chinese', voice: 'Polly.Zhiyu-Neural' },  // cmn-CN (Mandarin)
  ar: { locale: 'ar-IQ', name: 'Arabic', voice: 'Polly.Hala-Neural' },    // ar-AE (Gulf Arabic; nearest neural voice to ar-IQ)
  ku: { locale: 'ku-IQ', name: 'Kurdish' },
  ti: { locale: 'ti-ET', name: 'Tigrinya' },
  sw: { locale: 'sw-KE', name: 'Swahili' },
  uk: { locale: 'uk-UA', name: 'Ukrainian' },
  rw: { locale: 'rw-RW', name: 'Kinyarwanda' },
  ru: { locale: 'ru-RU', name: 'Russian' },
  am: { locale: 'am-ET', name: 'Amharic' },
  fa: { locale: 'fa-AF', name: 'Dari' },
  vi: { locale: 'vi-VN', name: 'Vietnamese' },
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

module.exports = { langMap, sayAttrs, sayLangMap, messagesMap, formatE164 };
