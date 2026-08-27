const { sendToGroup } = require(Runtime.getAssets()['/signalOps.js'].path);

const notify = async function (context, message, attachment_path = null) {
  console.log('NOTIFY', message);
  await sendToGroup(context, { message, attachment_path });
  return 'OK';
};

const prepareAttachment = async function (context, attachment_url, attachment_filename) {
  const axios = require('axios');
  const fs = require('fs');
  const tmp_dir = require('os').tmpdir();
  const attachmentResponse = await axios.get(attachment_url,
    {
      auth: {
        username: context.ACCOUNT_SID,
        password: context.AUTH_TOKEN,
      },
      responseType: 'arraybuffer',
    },
  );
  const attachment_path = tmp_dir + '/' + attachment_filename;
  fs.writeFileSync(attachment_path, attachmentResponse.data);
  return attachment_path;
};

module.exports = { notify, prepareAttachment };
