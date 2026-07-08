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

// A reason string safe to put in a Signal message. A calendar feed URL is often
// secret-bearing (Google's "secret address"), and axios error messages can embed
// the host, so report only the status or the network error code.
function failureReason(err) {
  if (err.response) return 'HTTP ' + err.response.status;
  return err.code || 'unreadable calendar data';
}

// Alert the operator group that the schedule is stale. Best effort in both
// directions: a Signal outage must not fail the call, and a calendar that stays
// down must not send one message per inbound call. The timestamp lives in module
// scope, so Twilio's warm container suppresses repeats for as long as it lives —
// a damper, not a guarantee, since a cold start starts the clock over.
const ICS_ALERT_INTERVAL_MS = 15 * 60 * 1000;
let lastIcsAlertAt = 0;

async function alertIcsFailure(context, err) {
  const now = Date.now();
  if (now - lastIcsAlertAt < ICS_ALERT_INTERVAL_MS) return;
  // Stamp before sending: a failing notify should not retry on every call.
  lastIcsAlertAt = now;
  try {
    const { notify } = require(Runtime.getAssets()['/notify.js'].path);
    await notify(context, 'Hotline: could not read the on-call calendar (' + failureReason(err) +
      '). Operator availability is frozen at the last known schedule until the feed recovers.');
  } catch (e) {
    console.error('ics_alert_notify_failed ' + (e.message || e));
  }
}

// Read the feed and reduce it to the operators on call right now. Throws if the
// feed is unreachable or is not a calendar at all.
async function fetchOperatorsOnCall(icsUrl) {
  const ics_response = await axios.get(icsUrl);
  const body = typeof ics_response.data === 'string' ? ics_response.data : String(ics_response.data);
  // A 200 can still carry a login page or an error blob. node-ical parses those
  // into zero events without complaint, which is indistinguishable from "nobody
  // is on call" and would retire the whole roster. Every iCalendar feed opens
  // with VCALENDAR, so require it; a genuinely empty schedule still has one.
  if (!/BEGIN:VCALENDAR/i.test(body)) {
    throw new Error('response is not an iCalendar feed');
  }
  return getEventsNow(body);
}

// Everyone in the directory, on call at the primary tier. Used when no calendar
// feed is configured: without a schedule there is nothing to be off-call for.
// The directory maps every alias to the same operator, so key by phone to emit
// each operator once — the caller turns each entry into a TaskRouter round trip.
function allOperatorsOnCall(operatorsByName) {
  const onCall = {};
  const seenPhones = new Set();
  for (const name in operatorsByName) {
    const phone = operatorsByName[name].phone;
    if (seenPhones.has(phone)) continue;
    seenPhones.add(phone);
    onCall[name] = { tier: 1 };
  }
  return onCall;
}

const updateWorkers = async function (context) {
  console.log("Updating workers...");
  const operatorsByName = getWorkerDirectory(context);

  // ICS_URL is optional: the dashboard lets an admin clear it to turn off
  // schedule-based availability. Fetching an unset URL throws, so branch on it.
  const icsUrl = (context.ICS_URL || '').trim();
  let operatorsOnCall;
  if (icsUrl) {
    try {
      operatorsOnCall = await fetchOperatorsOnCall(icsUrl);
    } catch (e) {
      // The feed is down. Leave every worker exactly as the last successful sync
      // left them: a stale roster still answers calls, whereas syncing against a
      // feed we could not read would mark the entire roster unavailable.
      console.error('ics_read_failed ' + (e.message || e));
      await alertIcsFailure(context, e);
      return;
    }
  } else {
    console.log("No ICS_URL configured; treating all operators as on call.");
    operatorsOnCall = allOperatorsOnCall(operatorsByName);
  }

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
