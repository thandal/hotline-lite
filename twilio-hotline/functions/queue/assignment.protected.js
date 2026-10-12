exports.handler = function (context, event, callback) {
  // console.log("ASSIGNMENT " + event.ReservationSid);
  const workerAttributes = JSON.parse(event.WorkerAttributes);
  const taskAttributes = JSON.parse(event.TaskAttributes);
  // We use instruction : "call" rather than "dequeue" so that we can offer the preCall interaction.
  // See https://www.twilio.com/docs/taskrouter/handle-assignment-callbacks#initiating-call
  return callback(null, {
    "instruction": "call",
    //"accept": true,  // Accepting happens in preCall's dial.queue, if the operator accepts.
    "to": workerAttributes.phone,
    "from": context.HOTLINE_PHONE_NUMBER,
    "timeout": 15,  // Ring the phone for 15 s, so we'll (probably) give up before going to voicemail.
    // NOTE: relative urls not supported here, so we roll our own.
    // ... including passing along key bits of information.
    "url": "https://" +
      context.DOMAIN_NAME +
      "/queue/preCall?" +
      "taskSid=" + event.TaskSid +
      "&reservationSid=" + event.ReservationSid +
      "&callerFrom=" + encodeURIComponent(taskAttributes.from) +
      "&language=" + taskAttributes.language,
    // NOTE: by default, status_callback_url is only called when the *worker's* call *completes*.
    // To get updates on other events (like initiated, ringing, answered), we need to specify status_callback_event.
    // "status_callback_event": ["initiated", "ringing", "answered", "completed"],
    // See: https://www.twilio.com/docs/taskrouter/workers-reservations#assignment-status-callback
    "status_callback_url": "https://" + context.DOMAIN_NAME +
      "/queue/assignmentStatusCallback?taskSid=" + event.TaskSid,
  });
};
