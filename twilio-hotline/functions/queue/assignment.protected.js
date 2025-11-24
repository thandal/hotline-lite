exports.handler = function (context, event, callback) {
  // console.log("ASSIGNMENT " + event.ReservationSid);
  const workerAttributes = JSON.parse(event.WorkerAttributes);
  const taskAttributes = JSON.parse(event.TaskAttributes);
  return callback(null, {
    "instruction": "call",
    //"accept": true,  // Accepting happens in preCall's dial.queue...
    "to": workerAttributes.phone,
    "from": context.HOTLINE_PHONE_NUMBER,
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
    "status_callback_url": "https://" + context.DOMAIN_NAME +
      "/queue/assignmentStatusCallback?taskSid=" + event.TaskSid,
  });
};
