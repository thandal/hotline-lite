exports.handler = async function (context, event, callback) {
  //console.log("POSTCALL " + event.taskSid + " " + event.language + " " + event.callerFrom);
  const { sayLangMap } = require(Runtime.getAssets()['/language.js'].path);
  const postMap = {
    "es": "Llamada finalizada. " +
      "Presione 1 para escuchar el número de nuevo. " +
      "Presione 2 para bloquearlo. " +
      "Presione 3 para marcarlo de nuevo.",
    "en": "Call finished. " +
      "Press 1 to repeat the caller's number. " +
      "Press 2 to add the caller to the blocklist. " +
      "Press 3 to call the caller back",
  }
  const twiml = new Twilio.twiml.VoiceResponse();
  if (!event.Digits) {
    const gather = twiml.gather({ numDigits: 1 });
    sayLangMap(gather, event.language, postMap);
  } else if (event.Digits == 1) {
    // Repeat the caller's number
    const postMap_repeat = {
      "es": "Esta llamada era de {number}",
      "en": "This call was from {number}",
    }
    sayLangMap(twiml, event.language, postMap_repeat, event.callerFrom);
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
    const postMap_block = {
      "es": "Se bloquearon llamadas de {number}",
      "en": "Blocking calls from {number}",
    }
    sayLangMap(twiml, event.language, postMap_block, event.callerFrom);
  } else if (event.Digits == 3) {
    // Call the number back
    const postMap_dial = {
      "es": "Marcando {number}",
      "en": "Calling {number}",
    }
    sayLangMap(twiml, event.language, postMap_dial, event.callerFrom);
    twiml.dial(event.callerFrom);
  }
  return callback(null, twiml);
};
