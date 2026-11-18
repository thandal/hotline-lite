exports.handler = function (context, event, callback) {
  //console.log("PRECALL " + event.taskSid + " " + event.reservationSid + " " + event.language + " " + event.callerFrom);
  const { sayLangMap, loadMessages, renderCallMessage } = require(Runtime.getAssets()['/language.js'].path);

  const twiml = new Twilio.twiml.VoiceResponse();
  
  const messages = loadMessages([event.language])[event.language];
  const languages = (context.LANGUAGES || 'es,en').split(',');
  // Fall back to the built-in name when HOTLINE_NAME has no entry for this language.
  const localizedName = (context.HOTLINE_NAME && context.HOTLINE_NAME.split(',')[languages.indexOf(event.language)]) || messages.name;
  // Callers with a named entry in Special Call Handling are announced by that
  // name (see assignment.protected.js).
  const precallMessages = messages.operator.precall;
  const template = event.callerName ? precallMessages.introNamed : precallMessages.intro;
  const intro = renderCallMessage(template, localizedName, event.callerName);

  if (!event.Digits) {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 15
    });
    sayLangMap(
      gather, 
      event.language, 
      intro,
      event.callerFrom
    );
    // By default, if no gather response happens within the timeout, reject the reservation.
    sayLangMap(
      twiml,
      event.language,
      precallMessages.noResponse,
      event.callerFrom
    );
    twiml.redirect("/queue/rejectReservation?taskSid=" + event.taskSid + "&reservationSid=" + event.reservationSid);
    twiml.hangup();
  } else {
    // Note: this "accepts" the task (see https://www.twilio.com/docs/taskrouter/lifecycle-task-state)
    twiml.dial({ hangupOnStar: true })
      .queue({ reservationSid: event.reservationSid });
    // After the call, we pop back here.
    twiml.redirect("/queue/postCall?" +
      "taskSid=" + event.taskSid +
      "&reservationSid=" + event.reservationSid +
      "&callerFrom=" + encodeURIComponent(event.callerFrom) +
      "&language=" + event.language);
  }

  return callback(null, twiml);
};
