exports.handler = async function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  console.log("QueueResult " + event.QueueResult);
  const twiml = new Twilio.twiml.VoiceResponse();
  const callerLanguage = event.language || context.LANGUAGES.split(',')[0] || 'en';
  // Only record if we left the queue -- not if the bridged dial completed.
  // Voice memos are delivered over Signal; without an active group (GROUP_KEY)
  // a recording would go nowhere, so skip the prompt and just hang up.
  if (event.QueueResult == 'leave' && context.GROUP_KEY) {
    sayLangMap(
      twiml,
      callerLanguage,
      messagesMap[callerLanguage].caller.record.prompt
    );
    twiml.record({
      finishOnKey: '*#',
      recordingStatusCallback: '/recordingStatusCallback?callerFrom=' + encodeURIComponent(event.callerFrom) + '&language=' + callerLanguage,
    });
  }
  twiml.hangup();
  return callback(null, twiml);
}
