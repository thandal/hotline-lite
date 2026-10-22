exports.handler = async function (context, event, callback) {
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  console.log("QueueResult " + event.QueueResult);
  const twiml = new Twilio.twiml.VoiceResponse();
  // The caller asked to leave a message, either by pressing 5 on hold, which
  // leaves the queue (QueueResult "leave"), or by pressing 5 on the
  // no-operators prompt, which redirects here with leaveMessage=1. Never
  // record after a bridged call completes.
  const wantsMessage = event.QueueResult == 'leave' || event.noQueue === '1';
  // Voice memos are delivered over Signal; without an active group (GROUP_KEY)
  // a recording would go nowhere, so skip the prompt and just hang up.
  if (wantsMessage && context.GROUP_KEY) {
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].caller.record.prompt
    );
    twiml.record({
      finishOnKey: '*#',
      recordingStatusCallback: '/recordingStatusCallback?callerFrom=' + encodeURIComponent(event.callerFrom) + '&language=' + event.language,
    });
  }
  twiml.hangup();
  return callback(null, twiml);
}
