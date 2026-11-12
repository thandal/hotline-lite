// Reached from /hotline when no on-call operator speaks the caller's language.
// The call is not queued, since nobody could take it, so this is a plain menu:
// 0 goes back to the language menu when there is more than one language, any other
// key or silence goes to /record to leave a message if messages are allowed. If 
// messages are not allowed, the call is ended with a goodbye. Like the language menu, 
// the options are said twice.
exports.handler = function (context, event, callback) {
  const { sayAttrs, loadMessages } = require(Runtime.getAssets()['/language.js'].path);
  const twiml = new Twilio.twiml.VoiceResponse();
  const languages = (context.LANGUAGES || 'es,en').split(',');
  const canLeaveMessage = !!context.GROUP_KEY;
  const canChooseLanguage = languages.length > 1;
  const messages = loadMessages(languages)[event.language].caller;
  const waitMessages = messages.wait.noOperator;
  const callerFrom = encodeURIComponent(event.callerFrom);
  const activeLanguages = encodeURIComponent(event.activeLanguages) || '';

  if (event.Digits && event.Digits != 0 && canLeaveMessage) {
    // If the caller can leave a message and pressed any key other than 0, 
    // go to /record to leave a message.
    //
    // /record is the queue's exit handler; noQueue=1 tells it the caller
    // asked for a message without having been queued.
    twiml.redirect('/record?noQueue=1&language=' + event.language + '&callerFrom=' + callerFrom);
  } else if (event.Digits && canChooseLanguage) {
    // If the caller can choose a different language and pressed 0, 
    // or if the caller pressed any key and can choose a different language 
    // but cannot leave a message, go back to the language menu.

    // The language menu is at /hotline. Adding Digits=0 makes it replay the menu 
    // without its first-call steps (gateway key sequence, roster sync).
    twiml.redirect('/hotline?Digits=0&activeLanguages=' + activeLanguages);
  } else {
    // Otherwise, tell the caller that no operators are available and give them their options.
    const options = canLeaveMessage && canChooseLanguage ? waitMessages.options.messageOrLanguage
      : canLeaveMessage ? waitMessages.options.message
      : canChooseLanguage ? waitMessages.options.language
      : null;
    // Only gather when there is a key to press. Say it twice.
    // The gather posts back here with the language and caller intact.
    const target = options
      ? twiml.gather({ numDigits: 1, action: '/noOperators?language=' + event.language + '&callerFrom=' + callerFrom + '&activeLanguages=' + activeLanguages })
      : twiml;
    for (let n = 0; n < 2; n++) {
      target.say(sayAttrs(event.language), waitMessages.notice);
      if (options) target.say(sayAttrs(event.language), options);
      target.pause({ length: 1 });
    }
    // If messages are enabled, no response to the menu is treated as a request to leave a message.
    // This lowers the barrier to leaving a message, since the caller doesn't have to interact with the menu at all.
    if (canLeaveMessage) {
      twiml.redirect('/record?noQueue=1&language=' + event.language + '&callerFrom=' + callerFrom);
    } else {
      // If messages are not enabled and the caller doesn't respond to the menu, the call is ended with a goodbye.
      twiml.say(sayAttrs(event.language), messages.main.goodbye);
      twiml.hangup();
    }
  }
  return callback(null, twiml);
};
