const es = {
  "name": "la linea comunitaria",
  "caller": {
    "main": {
      "hello": "Gracias por llamar a {hotline name}.",
      "menu": "Presione {key} para español.",
      "goodbye": "Cuídese."
    },
    "wait": {
      "connecting": "Alguien estará con usted en breve.",
      "leaveAMessage": "Por favor, permanezca en la línea o presione cualquier tecla para dejar un mensaje.",
      "noOperator": {
        "notice": "Lo sentimos, no hay operadores disponibles que hablen español.",
        "options": {
          "messageOrLanguage": "Permanezca en la línea para dejar un mensaje, o presione cualquier tecla para elegir otro idioma.",
          "message": "Permanezca en la línea para dejar un mensaje.",
          "language": "Presione cualquier tecla para elegir otro idioma."
        }
      }
    },
    "record": {
      "prompt": "Por favor, deje un mensaje después del tono."
    }
  },
  "operator": {
    "precall": {
      "intro": "Esta es una llamada de {hotline name}. Presione cualquier tecla para aceptar la llamada.",
      "introNamed": "Esta es una llamada de {caller name}, a través de {hotline name}. Presione cualquier tecla para aceptar la llamada.",
      "noResponse": "No respondió, así que pasamos a otro operador. Esta llamada era de {phone number}.",
      "reservationStatus": {
        "rescinded": "Otre operador respondió a esta llamada.",
        "canceled": "La persona en espera terminó la llamada.",
        "default": "La llamada se finalizó."
      }
    },
    "postcall": {
      "options": "Llamada finalizada. Presione 1 para escuchar el número de nuevo. Presione 2 para bloquearlo. Presione 3 para marcarlo de nuevo.",
      "callerNumber": "Esta llamada era de {phone number}.",
      "blocking": "Se bloquearon llamadas de {phone number}.",
      "callingBack": "Marcando {phone number}."
    }
  }
}
module.exports = es;
