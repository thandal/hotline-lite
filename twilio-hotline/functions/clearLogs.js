exports.handler = async function (context, event, callback) {
  console.log("CLEARING CALLS");
  const twilioClient = context.getTwilioClient();
  const calls = await twilioClient.calls.list({ limit: 20 });
  await Promise.all(calls.map((c) => twilioClient.calls(c.sid).remove())).catch(function () {
    console.log("Clearing Promise Rejected");
  });
  console.log("CLEARING MESSAGES");
  const messages = await twilioClient.messages.list({ limit: 20, dateSentBefore: new Date( Date.now() - 7 * 24 * 60 * 60 * 1000 ) }); // Select messages more than 7 days old
  await Promise.all(messages.map((m) => twilioClient.messages(m.sid).remove())).catch(function () {
    console.log("Clearing Promise Rejected");
  });
  return callback(null, 'cleared');
};
