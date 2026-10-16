exports.handler = async function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  console.log("QueueResult " + event.QueueResult);
  const twiml = new Twilio.twiml.VoiceResponse();
  // Only record if we left the queue -- not if the bridged dial completed.
  // Voice memos are delivered over Signal; without an active group (GROUP_KEY)
  // a recording would go nowhere, so skip the prompt and just hang up.
  if (event.QueueResult == 'leave' && context.GROUP_KEY) {
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].caller.record.prompt
    );
    twiml.record({
      finishOnKey: '*#',
      recordingStatusCallback: '/recordingStatusCallback?callerFrom=' + encodeURIComponent(event.callerFrom) + '&language=' + event.language,
    });
  } else if (event.QueueResult == 'redirected') {
    // /queue/wait pulled the call out of the queue with the REST API to send
    // the caller back to the language menu. Twilio requests this URL when that
    // happens but doesn't document whether the response runs; pointing it at
    // the menu too means the caller gets there either way, never a hangup.
    twiml.redirect('/hotline?Digits=0');
    return callback(null, twiml);
  }
  twiml.hangup();
  return callback(null, twiml);
}
