exports.handler = async function (context, event, callback) {
  //console.log("POSTCALL " + event.taskSid + " " + event.language + " " + event.callerFrom);
  const { sayLangMap, messagesMap } = require(Runtime.getAssets()['/language.js'].path);
  const twiml = new Twilio.twiml.VoiceResponse();
  if (!event.Digits) {
    const gather = twiml.gather({ numDigits: 1 });
    sayLangMap(
      gather,
      event.language,
      messagesMap[event.language].operator.postcall.options,
      event.callerFrom
    );
  } else if (event.Digits == 1) {
    // Repeat the caller's number
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].operator.postcall.callerNumber,
      event.callerFrom
    );
    twiml.redirect('');  // Redirects to the current URL
  } else if (event.Digits == 2) {
    // Add to blocklist
    const client = context.getTwilioClient();
    const variables = await client.serverless.v1.services(context.SERVICE_SID)
      .environments(context.ENVIRONMENT_SID)
      .variables.list();
    let blockListSid = "";
    for (let i = 0; i < variables.length; i++) {
      const v = variables[i];
      if (v.key == "BLOCKLIST") {
        blockListSid = v.sid;
        break;
      }
    }
    const blockList = (context.BLOCKLIST == "null") ? event.callerFrom : context.BLOCKLIST + "," + event.callerFrom;
    await client.serverless.v1.services(context.SERVICE_SID)
      .environments(context.ENVIRONMENT_SID)
      .variables(blockListSid)
      .update({ value: blockList });
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].operator.postcall.blocking,
      event.callerFrom
    );
  } else if (event.Digits == 3) {
    // Call the number back
    sayLangMap(
      twiml,
      event.language,
      messagesMap[event.language].operator.postcall.callingBack,
      event.callerFrom
    );
    twiml.dial(event.callerFrom);
  }
  return callback(null, twiml);
};
