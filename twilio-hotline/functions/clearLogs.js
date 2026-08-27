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
  // Only clear calls that ended a while ago. recordingStatusCallback fires at
  // the same moment as this one, and it needs the recording to still be there
  // while it downloads the voice memo and hands it to Signal.
  const calls = await twilioClient.calls.list({ limit: 20, endTimeBefore: new Date( Date.now() - 60 * 60 * 1000 ) }); // Select calls that ended more than an hour ago
  await Promise.all(calls.map(async (c) => {
    await removeRecordings(c);
    await twilioClient.calls(c.sid).remove();
  })).catch(function () {
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
  await Promise.all(messages.map(async (m) => {
    await removeMedia(m);
    await twilioClient.messages(m.sid).remove();
  })).catch(function () {
    console.log("Clearing Message Log Promise Rejected");
  });

  return callback(null, '');
};
