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
  const messages = messagesMap[event.language].caller;
  const callerFrom = encodeURIComponent(event.callerFrom);

  if (event.Digits == 5 && canLeaveMessage) {
    // /record is the queue's exit handler; leaveMessage=1 tells it the caller
    // asked for a message without having been queued.
    twiml.redirect('/record?leaveMessage=1&language=' + event.language + '&callerFrom=' + callerFrom);
  } else if (event.Digits == 0 && canChooseLanguage) {
    // Digits=0 makes /hotline replay the menu without its first-call steps
    // (gateway key sequence, roster sync).
    twiml.redirect('/hotline?Digits=0');
  } else {
    const options = canLeaveMessage && canChooseLanguage ? messages.noOperators.messageOrLanguage
      : canLeaveMessage ? messages.noOperators.message
      : canChooseLanguage ? messages.noOperators.language
      : null;
    // Only gather when there is a key to press. The gather posts back here with
    // the language and caller intact.
    const target = options
      ? twiml.gather({ numDigits: 1, action: '/noOperators?language=' + event.language + '&callerFrom=' + callerFrom })
      : twiml;
    for (let n = 0; n < 2; n++) {
      target.say(sayAttrs(event.language), messages.noOperators.sorry);
      if (options) target.say(sayAttrs(event.language), options);
      target.pause({ length: 1 });
    }
    twiml.say(sayAttrs(event.language), messages.welcome.goodbye);
    twiml.hangup();
  }
  return callback(null, twiml);
};
