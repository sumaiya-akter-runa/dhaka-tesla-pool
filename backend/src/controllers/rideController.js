const prisma = require("../lib/prisma");
const { calculateFarePaisa } = require("../services/fareEngine");
const { transitionRide } = require("../services/rideStatusService");
const { canCancel } = require("../services/rideStateMachine");

// The final fare (farePaisa) is only known once the driver accepts and we
// know whether the ride pooled. Before that, show a solo-ride estimate so
// the passenger always sees *something*, on every poll — not just the
// moment right after they submitted the request.
function withDisplayFare(ride) {
  return {
    ...ride,
    displayFarePaisa: ride.farePaisa ?? calculateFarePaisa(ride.destinationZone, false),
  };
}

async function createRide(req, res, next) {
  try {
    const { pickupZone, destinationZone, seatsRequested } = req.body;

    const rideRequest = await prisma.rideRequest.create({
      data: {
        passengerId: req.user.id,
        pickupZone,
        destinationZone,
        seatsRequested,
        status: "REQUESTED",
      },
    });

    await prisma.rideStatusHistory.create({
      data: {
        rideRequestId: rideRequest.id,
        status: "REQUESTED",
        changedBy: req.user.id,
      },
    });

    // Estimated (pre-pool) fare, shown immediately; recalculated on accept
    // once we know whether the ride actually ended up pooled.
    res.status(201).json(withDisplayFare(rideRequest));
  } catch (err) {
    next(err);
  }
}

async function listMyRides(req, res, next) {
  try {
    const rides = await prisma.rideRequest.findMany({
      where: { passengerId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { membership: { include: { pool: true } } },
    });
    res.json(rides.map(withDisplayFare));
  } catch (err) {
    next(err);
  }
}

async function getRide(req, res, next) {
  try {
    const ride = await prisma.rideRequest.findUnique({
      where: { id: req.params.id },
      include: {
        membership: { include: { pool: true } },
        statusHistory: { orderBy: { changedAt: "asc" } },
      },
    });
    if (!ride) return res.status(404).json({ error: "Ride request not found" });

    // A passenger can only see their own ride; a driver can see any ride
    // that's part of a pool on one of their vehicles.
    if (req.user.role === "PASSENGER" && ride.passengerId !== req.user.id) {
      return res.status(403).json({ error: "Not your ride" });
    }

    res.json(withDisplayFare(ride));
  } catch (err) {
    next(err);
  }
}

async function cancelRide(req, res, next) {
  try {
    const ride = await prisma.rideRequest.findUnique({ where: { id: req.params.id } });
    if (!ride) return res.status(404).json({ error: "Ride request not found" });
    if (ride.passengerId !== req.user.id) {
      return res.status(403).json({ error: "Not your ride" });
    }
    if (!canCancel(ride.status)) {
      return res.status(409).json({ error: `Cannot cancel a ride in status ${ride.status}` });
    }

    const updated = await transitionRide(ride, "CANCELLED", req.user.id);

    // Free up the seat if it had already been reserved in a pool.
    const membership = await prisma.poolMembership.findUnique({
      where: { rideRequestId: ride.id },
    });
    if (membership) {
      const pool = await prisma.pool.update({
        where: { id: membership.poolId },
        data: { occupiedSeats: { decrement: membership.seats }, status: "OPEN" },
      });
      void pool;
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { createRide, listMyRides, getRide, cancelRide };