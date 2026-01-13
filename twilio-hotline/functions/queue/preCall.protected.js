exports.handler = function (context, event, callback) {
  //console.log("PRECALL " + event.taskSid + " " + event.reservationSid + " " + event.language + " " + event.callerFrom);
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);

  const twiml = new Twilio.twiml.VoiceResponse();

  if (!event.Digits) {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 15
    });
    sayLangMap(gather, event.language, messagesMap[event.language].operator.precall.intro, event.callerFrom);
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
    twiml.redirect("/queue/postCall?" +
      "taskSid=" + event.taskSid +
      "&callerFrom=" + encodeURIComponent(event.callerFrom) +
      "&language=" + event.language);
  }

  return callback(null, twiml);
};
