exports.handler = async function (context, event, callback) {
  // Validate the incoming request using Twilio's request validation method.
  // We don't want to process requests that aren't actually from Twilio.
  /*
  let twilioSignature;
  try { twilioSignature = event.headers['X-Twilio-Signature'] || event.headers['x-twilio-signature']; }
  catch (e) { 
    console.warn('Failed to extract Twilio signature', event.headers); 
    return callback(null, ''); 
  }
  const client = context.getTwilioClient();
  const url = context.DOMAIN_NAME + '/inboundSmsMessage';
  const params = event.body || {};
  const isValidRequest = client.validateRequest(
    context.AUTH_TOKEN,
    twilioSignature,
    url,
    params
  );
  if (!isValidRequest) {
    console.error('Invalid request signature', event.headers, event.body);
    return callback(null, '');
  }
  */

  // We want to ignore messages from numbers that are on our blocklist,
  // or if the system is in allowlist-only mode and the number isn't on the allowlist.
  let connectionSequences = [];
  try { connectionSequences = JSON.parse(context.CONNECTION_SEQUENCES || '[]'); }
  catch (e) { connectionSequences = []; }
  if (!Array.isArray(connectionSequences)) connectionSequences = [];
  const allowlistOnly = context.ALLOWLIST_ONLY === 'true';
  const callerSequence = connectionSequences.find(s => s && s.number === event.From);

  // BLOCKLIST may be unset (it isn't pre-provisioned), empty, or the 'null'
  // sentinel admin writes for an empty list — guard the split so a missing var
  // can't crash every call.
  const blocklist = (!context.BLOCKLIST || context.BLOCKLIST === 'null')
    ? [] : context.BLOCKLIST.split(',').filter(Boolean);

  if (blocklist.includes(event.From) || (allowlistOnly && !callerSequence)) {
    return callback(null, '');
  }

  // If the message is a 2FA code, we don't want to forward it to the group chat. 
  // Instead, we just log it and return a success response.
  const pattern = /code[^0-9]{0,40}(\d{3})[-\s]?(\d{3})/i;
  if (pattern.test(event.Body)) {
    return callback(null, '');
  }

  // Check for media attachments. If there are any, we want to send them to the group chat as well.
  let mediaUrls = [];
  if (event.NumMedia && parseInt(event.NumMedia) > 0) {
    const extName = require('ext-name');
    for (let i = 0; i < parseInt(event.NumMedia); i++) {
      let contentType = event[`MediaContentType${i}`];
      let extension = extName.mime(contentType)[0].ext;
      let filename = `attachment_${i + 1}.${extension}`;
      mediaUrls.push({ url: event[`MediaUrl${i}`], contentType: contentType, filename: filename });
    }

  }

  const { notify, prepareAttachment } = require(Runtime.getAssets()['/notify.js'].path);
  const { formatE164 } = require(Runtime.getAssets()['/language.js'].path);
  const messageType = event.To.includes('whatsapp') ? 'WhatsApp' : 'SMS';
  const attachmentText = mediaUrls.length > 0 ? ` with ${mediaUrls.length} attachment(s)` : '';
  let attachment_path = mediaUrls.length > 0 ? await prepareAttachment(context, mediaUrls[0].url, mediaUrls[0].filename) : null;
  let messageBody = event.Body + "\n\n---\n" + messageType + " from " + formatE164(event.From) + attachmentText;
  await notify(context, messageBody, attachment_path);

  if (mediaUrls.length > 1) {
    for (let media of mediaUrls) {
      attachment_path = await prepareAttachment(context, media.url, media.filename);
      await notify(context, "", attachment_path);
    }
  }

  // Wait a moment to ensure the message is sent before returning.
  // This is a workaround for Twilio runtime errors that can occur 
  // if the function returns too quickly.
  await new Promise(resolve => setTimeout(resolve, 2000));
  return callback(null, '');

}
