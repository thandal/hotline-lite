exports.handler = async function (context, event, callback) {
  console.log("/record QueueResult " + event.QueueResult);
  const { sayLangMap } = require(Runtime.getAssets()['/language.js'].path);
  const twiml = new Twilio.twiml.VoiceResponse();
  // Only record if we left the queue -- not if the bridged dial completed.
  if (event.QueueResult == 'leave') {
    const recordMap = {
      en: 'Please leave a message after the beep.',
      es: 'Por favor, deje un mensaje después del pitido.',
    };
    sayLangMap(twiml, event.language, recordMap);
    twiml.record({
      finishOnKey: '*#',
      recordingStatusCallback: '/recordingStatusCallback?callerFrom=' + encodeURIComponent(event.callerFrom),
      });
  }
  twiml.hangup();
  return callback(null, twiml);
}
