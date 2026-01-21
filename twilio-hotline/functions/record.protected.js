exports.handler = async function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  console.log("QueueResult " + event.QueueResult);
  const twiml = new Twilio.twiml.VoiceResponse();
  // Only record if we left the queue -- not if the bridged dial completed.
  if (event.QueueResult == 'leave') {
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].caller.record.prompt
    );
    twiml.record({
      finishOnKey: '*#',
      // TODO: enabled this when voicemail notification is implemented
      //recordingStatusCallback: '/recordingStatusCallback?callerFrom=' + encodeURIComponent(event.callerFrom),
      });
  }
  twiml.hangup();
  return callback(null, twiml);
}
