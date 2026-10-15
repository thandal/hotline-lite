export async function handler (context, event, callback) {
    const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
    const { isOperator } = require(Runtime.getAssets()['/updateWorkers.js'].path);
    
    const language = event.language || context.LANGUAGES.split(',')[0] || 'en';
    const twiml = new Twilio.twiml.VoiceResponse();

    if ( !isOperator(context, event) ) {
        // If the caller is not an operator, end the call.
        sayLangMap(twiml, language, messagesMap[language].caller.welcome.goodbye);
        twiml.hangup();
        return callback(null, twiml);
    }

    if ( !event.Digits ) {
        // If the caller is an operator, prompt them to enter the number to call.
        const gather = twiml.gather({ numDigits: 10, finishOnKey: '#' });
        sayLangMap(gather, language, messagesMap[language].operator.outbound.prompt);
    } else if ( event.Digits.length == 10 ) {
        // If they've entered a number, read the number back to them and confirm.
        const numberToCall = event.Digits;
        const gather = twiml.gather({ 
            numDigits: 1, 
            action: '/outbound?language=' + language + '&numberToCall=' + encodeURIComponent(numberToCall) });
        sayLangMap(gather, language, messagesMap[language].operator.outbound.confirmation, numberToCall);
    } else if ( event.numberToCall && event.Digits <= 2 ) {
        if ( event.Digits == '2' ) {
            // If they chose to re-enter the number, redirect them back to the prompt.
            twiml.redirect('/outbound?language=' + language);
        } else {
            // If they confirmed the number, initiate the outbound call.
            const numberToCall = event.numberToCall;
            twiml.sayLangMap(language, messagesMap[language].operator.outbound.calling, numberToCall);
            twiml.dial(numberToCall);
        }
    } else {
        // If they entered an invalid number, redirect them back to the prompt.
        sayLangMap(twiml, language, messagesMap[language].operator.outbound.invalid);
        twiml.redirect('/outbound?language=' + language);
    }
}
