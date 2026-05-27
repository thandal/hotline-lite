exports.handler = async function (context, event, callback) {
  console.log('/recordingStatusCallback ' + event.RecordingUrl);
  const { langToLangLocale, formatE164 } = require(Runtime.getAssets()['/language.js'].path);
  const axios = require('axios');
  const https = require('https');
  const fs = require('fs');
  const tmp_dir = require('os').tmpdir();
  const recordingResponse = await axios.get(event.RecordingUrl + '.mp3',
                                            {
                                              auth: {
                                                username: context.ACCOUNT_SID,
                                                password: context.AUTH_TOKEN,
                                              },
                                              responseType: 'arraybuffer',
                                            },
  );
  const recordingStartTime = new Date(event.RecordingStartTime);
  // Colons are not filesystem/Dropbox-safe, so strip them out of the ISO timestamp.
  const timestamp = recordingStartTime.toISOString().replace(/:/g, '-');
  const attachment_filename = timestamp + '_' + event.callerFrom + '.mp3';
  const attachment_path = tmp_dir + '/' + attachment_filename;
  fs.writeFileSync(attachment_path, recordingResponse.data);
  const { notify } = require(Runtime.getAssets()['/notify.js'].path);
  const languageName = langToLangLocale[event.language] ? langToLangLocale[event.language][1] : event.language;
  await notify(context, 'New voice memo in ' + languageName + ' from ' + formatE164(event.callerFrom), attachment_path);
  return callback(null, 'OK');
}
