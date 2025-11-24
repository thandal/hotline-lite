const axios = require('axios'); 
const ical = require('node-ical');

// Get all events occurring at the current time
function getEventsNow(ics) {
  const now = new Date();
  const events = ical.parseICS(ics);
  const currentEvents = [];
  for (const key in events) {
    const event = events[key];
    // Skip non-event entries
    if (event.type !== 'VEVENT') continue;
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
          currentEvents.push(event.summary);
        }
      });
    }
    // Handle single occurrence events
    else if (event.start <= now && now <= event.end) {
      currentEvents.push(event.summary);
    }
  }
  return currentEvents;
}

const updateWorkers = async function (context) {
  console.log("Updating workers...");
  const ics_response = await axios.get(context.ICS_URL);
  const nicknamesNow = getEventsNow(ics_response.data);

  const nicknameMap = JSON.parse(context.ROSTER)
  const client = context.getTwilioClient();
  const availableActivitySid = (await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).activities.list({ friendlyName: 'Available' }))[0].sid;
  const unavailableActivitySid = (await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).activities.list({ friendlyName: 'Unavailable' }))[0].sid;

  // Create the workers blindly, catch any errors
  const friendlyNamesNow = new Set(); 
  for (let i = 0; i < nicknamesNow.length; i++) {
    const nickname = nicknamesNow[i];
    const friendlyName = 'worker' + nicknameMap[nickname]['phone'];
    friendlyNamesNow.add(friendlyName);
    await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).workers
      .create({ friendlyName: friendlyName, activitySid: availableActivitySid, attributes: JSON.stringify(nicknameMap[nickname]) })
      .catch((e) => {
        // Will complain if the worker already exists...
        //console.error(e);
    });
  }

  const workers = await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).workers.list();
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    if (!friendlyNamesNow.has(w.friendlyName)) {
      // Mark unavailable.
      await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).workers(w.sid).update({ activitySid: unavailableActivitySid });
      // Then remove. NOTE: removal may fail if they are currently in a call... In which case we'll just catch them next time.
      await client.taskrouter.v1.workspaces(context.WORKSPACE_SID).workers(w.sid).remove();
    }
  }
  console.log("Done updating workers");
};

module.exports = { updateWorkers };
