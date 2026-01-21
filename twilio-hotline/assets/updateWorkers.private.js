const axios = require('axios');
const ical = require('node-ical');

// Get all events occurring at the current time
function getEventsNow(ics) {
  const now = new Date();
  const events = ical.parseICS(ics);
  const currentEvents = [];
  for (const key in events) {
    const event = events[key];
    const attributes = {};
    // Skip non-event entries
    if (event.type !== 'VEVENT') continue;
    // Check for operator priority level
    if (event.location && /back\s*up|secondary/i.test(event.location)) {
      attributes['tier'] = 2;
    }
    else {
      attributes['tier'] = 1;
    }
    // Handle recurring events
    if (event.rrule) {
      // Generate all event occurrences today
      // NOTE: between() only generates events that *start* between the given
      // dates.
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      // NOTE: the resulting dates are in busted UTC!?!
      const bustedUtcDates = event.rrule.between(start, end, true);
      // Check the specific event times
      bustedUtcDates.forEach(bustedUtcDate => {
        const date = new Date(bustedUtcDate.getTime() + now.getTimezoneOffset() * 60 * 1000);
        const duration = event.end - event.start;
        const occurrenceEnd = new Date(date.getTime() + duration);
        if (date <= now && now <= occurrenceEnd) {
          currentEvents[event.summary] = attributes;
        }
      });
    }
    // Handle single occurrence events
    else if (event.start <= now && now <= event.end) {
      currentEvents[event.summary] = attributes;
    }
  }
  return currentEvents;
}

function getWorkerDirectory(context) {
  const workerDirectory = {};
  const regex = /^worker/i;
  const registeredWorkers = Object.keys(context).filter(key => regex.test(key));
  for (let i = 0; i < registeredWorkers.length; i++) {
    workerAttributes = JSON.parse(context[registeredWorkers[i]]);
    twilioAttributes = { 'phone': workerAttributes.phone, 'languages': workerAttributes.languages };
    for (const name in workerAttributes.names) {
      workerDirectory[workerAttributes.names[name]] = twilioAttributes;
    }
  }
  return workerDirectory;
}

const updateWorkers = async function (context) {
  console.log("Updating workers...");
  const ics_response = await axios.get(context.ICS_URL);
  const operatorsOnCall = getEventsNow(ics_response.data);

  const operatorsByName = getWorkerDirectory(context);

  const client = context.getTwilioClient();
  const availableActivitySid = (await client.taskrouter.v1
    .workspaces(context.WORKSPACE_SID)
    .activities
    .list({ friendlyName: 'Available' }))[0]
    .sid;
  const unavailableActivitySid = (await client.taskrouter.v1
    .workspaces(context.WORKSPACE_SID)
    .activities
    .list({ friendlyName: 'Unavailable' }))[0]
    .sid;

  // Create the workers blindly, catch any errors
  const friendlyNamesNow = new Set();
  for (let i = 0; i < Object.keys(operatorsOnCall).length; i++) {
    let workerExists = false;
    const operatorName = Object.keys(operatorsOnCall)[i];
    if (!(operatorName in operatorsByName)) {
      console.log(`Operator ${operatorName} is scheduled but not in the worker directory; skipping.`);
      continue;
    }
    const friendlyName = 'worker' + operatorsByName[operatorName]['phone'].slice(-4);
    friendlyNamesNow.add(friendlyName);
    await client.taskrouter.v1.workspaces(context.WORKSPACE_SID)
      .workers
      .create({
        friendlyName: friendlyName,
        activitySid: availableActivitySid,
        attributes: JSON.stringify({ ...operatorsByName[operatorName], ...operatorsOnCall[operatorName] }),
      })
      .catch((e) => {
        // Will complain if the worker already exists...
        // console.error(e);
        workerExists = true;
      });
    if (workerExists) {
      // Make sure they are marked available and have up-to-date attributes
      const worker_sid = (await client.taskrouter.v1
        .workspaces(context.WORKSPACE_SID)
        .workers
        .list({ friendlyName: friendlyName }))[0]
        .sid;
      await client.taskrouter.v1
        .workspaces(context.WORKSPACE_SID)
        .workers(worker_sid)
        .update({
          activitySid: availableActivitySid,
          attributes: JSON.stringify({ ...operatorsByName[operatorName], ...operatorsOnCall[operatorName] }),
        });
    }
  }

  const workers = await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).workers.list();
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    if (!friendlyNamesNow.has(w.friendlyName)) {
      // Mark unavailable.
      await client.taskrouter.v1
        .workspaces(context.WORKSPACE_SID)
        .workers(w.sid)
        .update({ activitySid: unavailableActivitySid });
      // Then remove. NOTE: removal may fail if they are currently in a call... In which case we'll just catch them next time.
      await client.taskrouter.v1
        .workspaces(context.WORKSPACE_SID)
        .workers(w.sid)
        .remove();
    }
  }
  console.log("Done updating workers");
};

module.exports = { updateWorkers };
