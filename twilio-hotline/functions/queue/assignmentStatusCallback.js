// NOTE: assignmentStatusCallback has to be public, for some reason!
exports.handler = async function (context, event, callback) {
  console.log("AssignmentStatusCallback " + event.taskSid); // NOTE: Lower case t! Manually added in the "call" instruction.
  const client = context.getTwilioClient();
  await client.taskrouter.v1
    .workspaces(context.WORKSPACE_SID)
    .tasks(event.taskSid)
    .update({ assignmentStatus: 'completed' })
    .catch(function () {
      console.log("AssignmentStatusCallback Promise Rejected");
    });
  return callback(null, "OK");
};
