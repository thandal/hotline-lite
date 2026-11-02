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
  const messageParts = message.split("{phone number}");
  for (let i = 0; i < messageParts.length; i++) {
    const say = twiml.say(sayAttrs(lang2), messageParts[i]);
    if (i < messageParts.length - 1) {
      const formattedPhone = formatE164(phone);
      say.sayAs({ "interpret-as": "telephone" }, formattedPhone);
    }
  }
}

// Placeholders, filled in by the code that speaks each message:
//   {hotline name}  the hotline's name in this language (HOTLINE_NAME, or `name` below)
//   {key}           the key to press for this language in the language menu
//   {caller name}   the name given to the caller's number in Special Call Handling
//   {phone number}  the caller's phone number, read out digit by digit
//
// A language can be offered on the hotline only once it has every message
// below (see supportedLanguages at the end of this file).
const messagesMap = {
  en: {
    name: "the community hotline",
    caller: {
      welcome: {
        hello: "Thank you for calling {hotline name}.",
        menu: "Press {key} for English.",
        goodbye: "Goodbye.",
      },
      wait: {
        connecting: "Someone will be with you shortly.",
        leaveAMessage: "Please remain on the line, or press any key to leave a message.",
        noOperator: {
          notice: "Sorry, no English-speaking operators are available.",
          options: {
            messageOrLanguage: "Press 0 to choose another language or press any other key to leave a message.",
            message: "Stay on the line or press any key to leave a message.",
            language: "Press 0 to choose another language.",
          },
        },
      },
      record: {
        prompt: "Please leave a message after the tone.",
      }
    },
    operator: {
      precall: {
        intro: "This is a call from {hotline name}. Press any key to accept the call.",
        introNamed: "This is a call from {caller name}, through {hotline name}. Press any key to accept the call.",
        noResponse: "You didn't respond, so we're moving on to another operator. This call was from {phone number}.",
        reservationStatus: {
          rescinded: "Another operator answered this call.",
          canceled: "The caller hung up.",
          default: "Someone else answered or the caller hung up.",
        }
      },
      postcall: {
        options: "Call finished. Press 1 to repeat the caller's number. Press 2 to add the caller to the blocklist. Press 3 to call the caller back.",
        callerNumber: "This call was from {phone number}.",
        blocking: "Blocking calls from {phone number}.",
        callingBack: "Calling {phone number}.",
      }
    }
  },
  es: {
    name: "la linea directa comunitaria",
    caller: {
      welcome: {
        hello: "Gracias por llamar a {hotline name}.",
        menu: "Presione {key} para español.",
        goodbye: "Cuídese.",
      },
      wait: {
        connecting: "Alguien estará con usted en breve.",
        leaveAMessage: "Por favor, permanezca en la línea o presione cualquier tecla para dejar un mensaje.",
        noOperator: {
          notice: "Lo sentimos, no hay operadores disponibles que hablen español.",
          options: {
            messageOrLanguage: "Presione 0 para elegir otro idioma, o presione cualquier otra tecla para dejar un mensaje.",
            message: "Permanezca en la línea o presione cualquier tecla para dejar un mensaje.",
            language: "Presione 0 para elegir otro idioma.",
          },
        },
      },
      record: {
        prompt: "Por favor, deje un mensaje después del tono.",
      }
    },
    operator: {
      precall: {
        intro: "Esta es una llamada de {hotline name}. Presione cualquier tecla para aceptar la llamada.",
        introNamed: "Esta es una llamada de {caller name}, a través de {hotline name}. Presione cualquier tecla para aceptar la llamada.",
        noResponse: "No respondió, así que pasamos a otro operador. Esta llamada era de {phone number}.",
        reservationStatus: {
          rescinded: "Otre operador respondió a esta llamada.",
          canceled: "La persona en espera terminó la llamada.",
          default: "La llamada se finalizó.",
        }
      },
      postcall: {
        options: "Llamada finalizada. Presione 1 para escuchar el número de nuevo. Presione 2 para bloquearlo. Presione 3 para marcarlo de nuevo.",
        callerNumber: "Esta llamada era de {phone number}.",
        blocking: "Se bloquearon llamadas de {phone number}.",
        callingBack: "Marcando {phone number}.",
      }
    }
  },
  fr: {
    name: "la ligne communautaire",
    caller: {
      welcome: {
        hello: "Merci d'avoir appelé {hotline name}.",
        menu: "Appuyez sur {key} pour le français.",
        goodbye: "Prenez soin de vous.",
      },
      wait: {
        connecting: "Quelqu'un sera avec vous sous peu.",
        leaveAMessage: "Veuillez rester en ligne, ou appuyez sur n'importe quelle touche pour laisser un message.",
        noOperator: {
          notice: "Désolé, aucun opérateur parlant français n'est disponible.",
          options: {
            messageOrLanguage: "Appuyez sur 0 pour choisir une autre langue, ou sur n'importe quelle autre touche pour laisser un message.",
            message: "Restez en ligne ou appuyez sur n'importe quelle touche pour laisser un message.",
            language: "Appuyez sur 0 pour choisir une autre langue.",
          },
        },
      },
      record: {
        prompt: "Veuillez laisser un message après le bip sonore.",
      }
    },
    operator: {
      precall: {
        intro: "Ceci est un appel de {hotline name}. Appuyez sur n'importe quelle touche pour accepter l'appel.",
        introNamed: "Ceci est un appel de {caller name}, via {hotline name}. Appuyez sur n'importe quelle touche pour accepter l'appel.",
        noResponse: "Aucune réponse, nous passons donc à un autre opérateur. Cet appel provenait de {phone number}.",
        reservationStatus: {
          rescinded: "Un autre opérateur a répondu à cet appel.",
          canceled: "La personne en attente a terminé l'appel.",
          default: "L'appel a été terminé.",
        }
      },
      postcall: {
        options: "Appel terminé. Appuyez sur 1 pour écouter le numéro à nouveau. Appuyez sur 2 pour le bloquer. Appuyez sur 3 pour le rappeler.",
        callerNumber: "Cet appel provenait de {phone number}.",
        blocking: "Les appels de {phone number} ont été bloqués.",
        callingBack: "Rappel de {phone number}.",
      }
    }
  }
};

// The languages the hotline can offer, in menu-list order: those with both a
// locale above and a full set of messages. langMap also lists languages with
// no messages yet, so the dashboard and the admin API check against this list.
const supportedLanguages = Object.keys(messagesMap).filter(code => langMap[code]);

module.exports = { langMap, sayAttrs, sayLangMap, messagesMap, formatE164, supportedLanguages };
