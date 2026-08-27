exports.handler = function (context, event, callback) {
  //console.log("PRECALL " + event.taskSid + " " + event.reservationSid + " " + event.language + " " + event.callerFrom);
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);

  const twiml = new Twilio.twiml.VoiceResponse();
  
  const languages = (context.LANGUAGES || 'es,en').split(',');
  const hotlineName = (context.HOTLINE_NAME) ? context.HOTLINE_NAME.split(',') : languages.map(x => messagesMap[x].name);
  const localizedName = hotlineName[languages.indexOf(event.language)] || messagesMap[event.language].name;

  if (!event.Digits) {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 15
    });
    sayLangMap(
      gather, 
      event.language, 
      messagesMap[event.language].operator.precall.intro.replace('{name}', localizedName), 
      event.callerFrom
    );
    // By default, if no gather response happens within the timeout, reject the reservation.
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].operator.precall.noResponse,
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
