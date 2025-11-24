exports.handler = async function (context, event, callback) {
  console.log("HELLO");

  // Signal message test
  //const { notify } = require(Runtime.getAssets()['/notify.js'].path);
  //await notify(context, "Test message", "/tmp/recording.mp3");

  // Worker update test
  const { updateWorkers } = require(Runtime.getAssets()['/updateWorkers.js'].path);
  const updateWorkersPromise = updateWorkers(context);
  console.log("I'M DOING STUFF WHILE THE WORKERS ARE UPDATING");
  console.log("ITS CRAZY TOWN");
  await updateWorkersPromise; // Make sure workers are updated *before* enqueing!


  return callback(null, "OK")
};
