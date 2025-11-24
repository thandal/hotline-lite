exports.handler = async function (context, event, callback) {
  console.log('/recordingStatusCallback ' + event.RecordingUrl);
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
  const attachment_path = tmp_dir + '/attachment.mp3';
  fs.writeFileSync(attachment_path, recordingResponse.data);
  const { notify } = require(Runtime.getAssets()['/notify.js'].path);
  await notify(context, 'New recording from ' + event.callerFrom, attachment_path);
  return callback(null, 'OK');
}
