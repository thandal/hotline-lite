// NOTE: Languages are by default mapped to voices by the Twilio settings here: https://console.twilio.com/us1/develop/voice/settings/text-to-speech
const langMap = {
  en: { locale: 'en-US', name: 'English', voice: 'Polly.Joanna-Generative' },
  es: { locale: 'es-MX', name: 'Spanish', voice: 'Polly.Lupe-Generative' },
  fr: { locale: 'fr-FR', name: 'French', voice: 'Polly.Lea-Generative' },
  pt: { locale: 'pt-BR', name: 'Portuguese', voice: 'Polly.Thiago-Neural' },
  ht: { locale: 'ht-HT', name: 'Haitian Creole', voice: 'Polly.Lupe-Generative' },
  zh: { locale: 'zh-CN', name: 'Chinese', voice: 'Polly.Zhiyu-Generative' },
  ar: { locale: 'ar-IQ', name: 'Arabic', voice: 'Polly.Hala-Neural' },
  ku: { locale: 'ku-IQ', name: 'Kurdish', voice: 'Polly.Hala-Neural' },
  ti: { locale: 'ti-ET', name: 'Tigrinya', voice: 'Polly.Hala-Neural' },
  sw: { locale: 'sw-KE', name: 'Swahili', voice: 'Polly.Hala-Neural' },
  uk: { locale: 'uk-UA', name: 'Ukrainian', voice: 'Polly.Tatyana' },
  rw: { locale: 'rw-RW', name: 'Kinyarwanda', voice: 'Polly.Hala-Neural' },
  ru: { locale: 'ru-RU', name: 'Russian', voice: 'Polly.Tatyana' },
  am: { locale: 'am-ET', name: 'Amharic', voice: 'Polly.Hala-Neural' },
  fa: { locale: 'fa-AF', name: 'Dari', voice: 'Polly.Hala-Neural' },
  vi: { locale: 'vi-VN', name: 'Vietnamese', voice: 'Polly.Zhiyu-Generative' },
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
    const say = twiml.say({ language: langMap[lang2].locale, voice: langMap[lang2].voice }, messageParts[i]);
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

module.exports = { langMap, sayLangMap, messagesMap, formatE164 };
