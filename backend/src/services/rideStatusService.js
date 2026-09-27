const prisma = require("../lib/prisma");
const { assertTransition } = require("./rideStateMachine");

/**
 * Validates the transition, then updates ride_requests.status and appends a
 * row to ride_status_history in a single transaction — so the log can never
 * drift from the current status (Section 4.2's "Why keep a history table").
 */
async function transitionRide(rideRequest, toStatus, changedByUserId) {
  assertTransition(rideRequest.status, toStatus);

  const [updated] = await prisma.$transaction([
    prisma.rideRequest.update({
      where: { id: rideRequest.id },
      data: { status: toStatus },
    }),
    prisma.rideStatusHistory.create({
      data: {
        rideRequestId: rideRequest.id,
        status: toStatus,
        changedBy: changedByUserId,
      },
    }),
  ]);

  return updated;
}

module.exports = { transitionRide };
