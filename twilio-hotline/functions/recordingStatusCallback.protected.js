exports.handler = async function (context, event, callback) {
  console.log('/recordingStatusCallback ' + event.RecordingUrl);
  const { langMap, formatE164 } = require(Runtime.getAssets()['/language.js'].path);
  const { notify, prepareAttachment } = require(Runtime.getAssets()['/notify.js'].path);

  const recordingStartTime = new Date(event.RecordingStartTime);
  // Colons are not filesystem/Dropbox-safe, so strip them out of the ISO timestamp.
  const timestamp = recordingStartTime.toISOString().replace(/:/g, '-');
  const attachment_filename = timestamp + '_' + event.callerFrom + '.mp3';
  const recording_url = event.RecordingUrl + '.mp3';
  const attachment_path = await prepareAttachment(context, recording_url, attachment_filename);

  const languageName = langMap[event.language] ? langMap[event.language].name : event.language;
  await notify(context, 'New voice memo in ' + languageName + ' from ' + formatE164(event.callerFrom), attachment_path);
  
  return callback(null, 'OK');
}
