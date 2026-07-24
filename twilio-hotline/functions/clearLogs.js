exports.handler = async function (context, event, callback) {
  console.log("CLEARING LOGS");
  const twilioClient = context.getTwilioClient();

  // Clear calls and their associated recordings
  const removeRecordings = async function (call) {
    const recordingsList = await twilioClient.calls(call.sid).recordings.list();
    await Promise.all(recordingsList.map((r) => twilioClient.calls(call.sid).recordings(r.sid).remove())).catch(function () {
      console.log("Clearing Recordings Promise Rejected");
    });
  };
  const calls = await twilioClient.calls.list({ limit: 20 });
  await Promise.all(calls.map((c) => removeRecordings(c) && twilioClient.calls(c.sid).remove())).catch(function () {
    console.log("Clearing Call Log Promise Rejected");
  });

  // Clear messages and their associated media
  const removeMedia = async function (message) {
    const mediaList = await twilioClient.messages(message.sid).media.list();
    await Promise.all(mediaList.map((m) => twilioClient.messages(message.sid).media(m.sid).remove())).catch(function () {
      console.log("Clearing Media Promise Rejected");
    });
  };
  const messages = await twilioClient.messages.list({ limit: 20, dateSentBefore: new Date( Date.now() - 7 * 24 * 60 * 60 * 1000 ) }); // Select messages more than 7 days old
  await Promise.all(messages.map((m) => removeMedia(m) && twilioClient.messages(m.sid).remove())).catch(function () {
    console.log("Clearing Message Log Promise Rejected");
  });

  return callback(null, '');
};
