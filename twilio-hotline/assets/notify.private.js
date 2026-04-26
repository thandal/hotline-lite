const { sendToGroup } = require(Runtime.getAssets()['/signalOps.js'].path);

const notify = async function (context, message, attachment_path = null) {
  console.log('NOTIFY', message);
  await sendToGroup(context, { message, attachment_path });
  return 'OK';
};

module.exports = { notify };
