exports.handler = async function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  // Voice memos are delivered over Signal; without an active group (GROUP_KEY)
  // a recording would go nowhere, so don't offer to take one.
  const signalConfigured = !!context.GROUP_KEY;
  // Set by /hotline when no on-call operator spoke the caller's language at
  // selection time. The call still waits in the queue, so an operator who comes
  // on call can take it; this only changes what the caller hears meanwhile.
  const noOperators = event.noOperators === '1';
  // Offering another language only makes sense when there is one to choose.
  const languages = (context.LANGUAGES || 'es,en').split(',');
  const canChooseLanguage = noOperators && languages.length > 1;
  const messages = messagesMap[event.language].caller.wait;
  // Twilio will loop this call while the user is waiting.
  const twiml = new Twilio.twiml.VoiceResponse();

  const sayHoldMessage = function () {
    if (noOperators) {
      const options = signalConfigured && canChooseLanguage ? messages.noOperatorsOptions.messageOrLanguage
        : signalConfigured ? messages.noOperatorsOptions.message
        : canChooseLanguage ? messages.noOperatorsOptions.language
        : null;
      if (options) {
        const gather = twiml.gather({ numDigits: 1 });
        sayLangMap(gather, event.language, messages.noOperators);
        sayLangMap(gather, event.language, options);
        gather.pause({ length: 2 });
      } else {
        // Nothing to press: one language and no message delivery. Say so and
        // keep waiting, in case an operator comes on call.
        sayLangMap(twiml, event.language, messages.noOperators);
        twiml.pause({ length: 7 });
      }
    } else if (signalConfigured) {
      const gather = twiml.gather({ numDigits: 1 });
      sayLangMap(gather, event.language, messages.connecting);
      gather.pause({ length: 2 });
      sayLangMap(gather, event.language, messages.leaveAMessage);
    } else {
      sayLangMap(twiml, event.language, messages.connecting);
      twiml.pause({ length: 2 });
    }
  };

  if (!event.Digits) {
    sayHoldMessage();
  } else if (event.Digits == 5 && signalConfigured) {
    // NOTE: record() isn't supported in waitUrl documents, so we
    // leave() the queue from here to come back to the enqueue verb.
    twiml.leave();
  } else if (event.Digits == 0 && canChooseLanguage) {
    // A waitUrl document can only hand the call back to the enqueue verb, so
    // pull it out of the queue with the REST API and send it to the language
    // menu instead; Twilio cancels the task when the call leaves the queue.
    // Digits=0 makes /hotline replay the menu without the first-call steps
    // (gateway key sequence, roster sync), and /record covers the exit from
    // the queue (QueueResult "redirected").
    try {
      await context.getTwilioClient().calls(event.CallSid).update({
        url: 'https://' + context.DOMAIN_NAME + '/hotline?Digits=0',
        method: 'POST',
      });
    } catch (e) {
      console.error('return_to_menu_failed ' + (e.message || e));
      sayHoldMessage();
    }
  }
  return callback(null, twiml);
};
