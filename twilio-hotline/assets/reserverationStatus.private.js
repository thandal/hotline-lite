const checkReservationStatus = async function (context, event) {
    const client = context.getTwilioClient();
    const reservation = await client.taskrouter.v1
        .workspaces(context.WORKSPACE_SID)
        .tasks(event.taskSid)
        .reservations(event.reservationSid)
        .fetch();

    // Note: possible statuses are: pending, accepted, rejected, rescinded, timeout, canceled, completed
    // See: https://www.twilio.com/docs/taskrouter/api/reservations#resource-properties
    // If the reservation is no longer pending, we should exit early.
    // This can happen if the task was canceled while we were in the process of assigning it.
    // If the caller hangs up, the reservation status will change to "canceled."
    // If another worker accepted the task first, the reservation status will be "rescinded."
    if (reservation.reservationStatus !== 'pending') {
        console.log("Reservation " + reservation.reservationSid + " no longer pending (" + reservation.reservationStatus + "), exiting.");
        return reservation.reservationStatus;
    }
}

module.exports = { checkReservationStatus };
