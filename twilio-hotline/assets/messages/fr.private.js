const fr = {
    "name": "l'assistance téléphonique communautaire",
    "caller": {
      "main": {
        "hello": "Merci d'avoir appelé {hotline name}.",
        "menu": "Pour le français, tapez {key}.",
        "goodbye": "Au revoir."
      },
      "wait": {
        "connecting": "Quelqu'un va bientôt vous répondre.",
        "leaveAMessage": "Veuillez rester en ligne ou appuyez sur n'importe quelle touche pour laisser un message.",
        "noOperator": {
          "notice": "Désolé, aucun opérateur francophone n'est disponible.",
          "options": {
            "messageOrLanguage": "Pour choisir une autre langue, tapez 0, ou appuyez sur n'importe quelle autre touche pour laisser un message.",
            "message": "Restez en ligne ou appuyez sur n'importe quelle touche pour laisser un message.",
            "language": "Pour choisir une autre langue, tapez 0."
          }
        }
      },
      "record": {
        "prompt": "Veuillez laisser un message après le bip sonore."
      }
    },
    "operator": {
      "precall": {
        "intro": "C'est un appel de {hotline name}. Appuyez sur n'importe quelle touche pour accepter l'appel.",
        "introNamed": "C'est un appel de {caller name} via {hotline name}. Appuyez sur n'importe quelle touche pour accepter l'appel.",
        "noResponse": "Vous n'avez pas répondu. Nous allons donc passer à un autre opérateur. Cet appel provenait du {phone number}.",
        "reservationStatus": {
          "rescinded": "Un autre opérateur a pris cet appel.",
          "canceled": "Le correspondant a raccroché.",
          "default": "Quelqu'un d'autre a pris l'appel ou le correspondant a raccroché."
        }
      },
      "postcall": {
        "options": "L'appel est terminé. Pour répéter le numéro du correspondant, tapez 1. Pour bloquer le correspondant, tapez 2. Pour rappeler le correspondant, tapez 3.",
        "callerNumber": "Cet appel provenait du {phone number}.",
        "blocking": "Appels du {phone number} bloqués.",
        "callingBack": "Appel au {phone number} en cours."
      }
    }
  }

module.exports = fr;
