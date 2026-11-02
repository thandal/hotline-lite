// Reached from /hotline when no on-call operator speaks the caller's language.
// The call is not queued, since nobody could take it, so this is a plain menu:
// 5 leaves a message when voice memos are set up, 0 goes back to the language
// menu when there is more than one language. Like the language menu, it is said
// twice, and silence or any other key ends the call with a goodbye.
exports.handler = function (context, event, callback) {
  const { sayAttrs, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  const twiml = new Twilio.twiml.VoiceResponse();
  const languages = (context.LANGUAGES || 'es,en').split(',');
  const canLeaveMessage = !!context.GROUP_KEY;
  const canChooseLanguage = languages.length > 1;
  const messages = messagesMap[event.language].caller.wait;
  const callerFrom = encodeURIComponent(event.callerFrom);
  const activeLanguages = encodeURIComponent(event.activeLanguages) || '';

  if (event.Digits && event.Digits != 0 && canLeaveMessage) {
    // /record is the queue's exit handler; noQueue=1 tells it the caller
    // asked for a message without having been queued.
    twiml.redirect('/record?noQueue=1&language=' + event.language + '&callerFrom=' + callerFrom);
  } else if (event.Digits == 0 && canChooseLanguage) {
    // Digits=0 makes /hotline replay the menu without its first-call steps
    // (gateway key sequence, roster sync).
    twiml.redirect('/hotline?Digits=0&activeLanguages=' + activeLanguages);
  } else {
    const options = canLeaveMessage && canChooseLanguage ? messages.noOperator.options.messageOrLanguage
      : canLeaveMessage ? messages.noOperator.options.message
      : canChooseLanguage ? messages.noOperator.options.language
      : null;
    // Only gather when there is a key to press. The gather posts back here with
    // the language and caller intact.
    const target = options
      ? twiml.gather({ numDigits: 1, action: '/noOperators?language=' + event.language + '&callerFrom=' + callerFrom + '&activeLanguages=' + activeLanguages })
      : twiml;
    for (let n = 0; n < 2; n++) {
      target.say(sayAttrs(event.language), messages.noOperator.notice);
      if (options) target.say(sayAttrs(event.language), options);
      target.pause({ length: 1 });
    }
    if (canLeaveMessage) {
      twiml.redirect('/record?noQueue=1&language=' + event.language + '&callerFrom=' + callerFrom);
    } else {
      twiml.say(sayAttrs(event.language), messages.welcome.goodbye);
      twiml.hangup();
    }
  }
  return callback(null, twiml);
};
