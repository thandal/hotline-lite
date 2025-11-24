const axios = require('axios'); 
const child_process = require('child_process');
const fs = require('fs');
const https = require('https'); 
const path = require('path');
const FormData = require('form-data');

const tmp_dir = require('os').tmpdir();

const notify = async function (context, message, attachment_path=null) {
  console.log("NOTIFY", message);

  // TODO: We could check to see if the db is already present, and reuse it?

  // Fetch presage database from cloud storage.
  const httpsAgent = https.Agent({
	  ca: Runtime.getAssets()['/simpleStorageServer_cert.pem'].open(),
  });
  const response = await axios.get(
    'https://shen.timbrel.org:8447/download/' + context.SERVICE_SID,
    { 
      httpsAgent: httpsAgent,
      responseType: 'arraybuffer',
    },
  );
  // Create a temporary local writeable copy of the presage database
  const tmp_db_path = path.join(tmp_dir, 'presage.db')
  fs.writeFileSync(tmp_db_path, response.data);
 
  // Use the temporary db during the presage calls
  //const ld = "/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2";  // Local (dev)
  const ld = "/bin/ld.so";  // Production (deployed to Twilio)
  const cmd = ld + " " + Runtime.getAssets()['/presage-cli.bin'].path + " --sqlite-db-path " + tmp_db_path + " --passphrase " + context.PRESAGE_PASSPHRASE;
  const receive_stdout = child_process.execSync(cmd + " receive --nostream");
  //console.log(receive_stdout.toString());
  if (attachment_path) {
    const send_stdout = child_process.execSync(cmd + " send-to-group --master-key " + context.GROUP_KEY + " --message '" + message + "' --attach " + attachment_path);
  } else {
    const send_stdout = child_process.execSync(cmd + " send-to-group --master-key " + context.GROUP_KEY + " --message '" + message + "' ");
  }

  // Update cloud storage with the newly synced tmp database
  await axios.post(
    'https://shen.timbrel.org:8447/upload/' + context.SERVICE_SID,
    fs.readFileSync(tmp_db_path),
    { 
      headers: { 'Content-Type': 'application/octet-stream' },
      maxBodyLength: 100000000,
      maxContentLength: 100000000,
      httpsAgent: httpsAgent,
    })
    .then(response => {
      console.log(response.data);
    }).catch(error => {
      console.log("ERROR");
      console.error(error);
      return "ERROR";
    });
  // Delete the temporary local copy.
  fs.unlinkSync(tmp_db_path);

  return "OK";
};

module.exports = { notify };
