exports.handler = function (context, event, callback) {
  //console.log("PRECALL " + event.taskSid + " " + event.reservationSid + " " + event.language + " " + event.callerFrom);
  const { sayLangMap } = require(Runtime.getAssets()['/language.js'].path);
  const introMap = {
    es: "Presione 0 para acceptar la llamada. " +
        "Presione 1 para repetir el número. " +
        "Presione 3 para rechazarla.",
    en: "Press 0 to accept the call. " +
        "Press 1 to repeat the caller's number. " +
        "Press 3 to reject the call.",
  }
  const twiml = new Twilio.twiml.VoiceResponse();
  if (!event.Digits) {
    const gather = twiml.gather({
        numDigits: 1,
        timeout: 15
      });
    sayLangMap(gather, event.language, introMap, event.callerFrom);
    // By default, if no gather response happens within the timeout, reject the reservation.
    console.log("AUTO-REJECTING the reservation " + event.reservationSid);
    twiml.say("Auto-rejecting the call.");
    twiml.redirect("/queue/rejectReservation?taskSid=" + event.taskSid + "&reservationSid=" + event.reservationSid);
    twiml.hangup();
  } if (event.Digits == 0) {
    // Note: this "accepts" the task.
    twiml.dial({ hangupOnStar: true })
      .queue({ reservationSid: event.reservationSid });
    twiml.redirect("/queue/postCall?" +
      "taskSid=" + event.taskSid +
      "&callerFrom=" + encodeURIComponent(event.callerFrom) +
      "&language=" + event.language);
  } if (event.Digits == 3) {
    console.log("REJECTING the reservation " + event.reservationSid);
    twiml.say("Rejecting the call.");
    twiml.redirect("/queue/rejectReservation?taskSid=" + event.taskSid + "&reservationSid=" + event.reservationSid);
    twiml.hangup();
  } else {
    // We say 'dial 1 to repeat', but really, if they dial anything except the cases above, we repeat.
    twiml.redirect('');  // Redirects to the current URL
  }
  return callback(null, twiml);
};
