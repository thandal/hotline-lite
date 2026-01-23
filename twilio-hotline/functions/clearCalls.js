exports.handler = async function (context, event, callback) {
  console.log("CLEARING CALLS");
  const twilioClient = context.getTwilioClient();
  const calls = await twilioClient.calls.list({ limit: 20 });
  await Promise.all(calls.map((c) => twilioClient.calls(c.sid).remove())).catch(function () {
    console.log("Clearing Promise Rejected");
  });
  return callback(null, 'cleared');
};
