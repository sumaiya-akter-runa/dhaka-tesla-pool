const prisma = require("../lib/prisma");
const { acceptRideRequest } = require("../services/matchingEngine");
const { transitionRide } = require("../services/rideStatusService");
const { calculateFarePaisa } = require("../services/fareEngine");

async function getMyVehicle(driverId) {
  const vehicle = await prisma.vehicle.findFirst({ where: { driverId } });
  if (!vehicle) {
    const err = new Error("This driver has no vehicle registered");
    err.status = 404;
    throw err;
  }
  return vehicle;
}

async function setVehicleStatus(req, res, next) {
  try {
    const vehicle = await getMyVehicle(req.user.id);
    const status = req.body.status === "ONLINE" ? "ONLINE" : "OFFLINE";
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// All REQUESTED ride requests whose pickup zone is compatible with this
// driver's vehicle's open pools, or simply all REQUESTED requests for a
// single-vehicle MVP — kept simple per the brief.
async function listRequests(req, res, next) {
  try {
    const requests = await prisma.rideRequest.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      include: { passenger: { select: { id: true, name: true } } },
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

// Rides currently assigned to this driver's vehicle (any pool membership),
// so the driver UI can show its active queue without re-deriving it from
// "all requests". Not in the original API sketch but needed to drive the
// arrived/start/complete flow from the frontend.
async function listMyAssignedRides(req, res, next) {
  try {
    const vehicle = await getMyVehicle(req.user.id);
    const memberships = await prisma.poolMembership.findMany({
      where: { pool: { vehicleId: vehicle.id } },
      include: { rideRequest: { include: { passenger: { select: { id: true, name: true } } } }, pool: true },
      orderBy: { joinedAt: "desc" },
    });
    res.json(memberships.map((m) => ({ ...m.rideRequest, pool: m.pool })));
  } catch (err) {
    next(err);
  }
}

async function acceptRequest(req, res, next) {
  try {
    const vehicle = await getMyVehicle(req.user.id);
    const rideRequest = await prisma.rideRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!rideRequest) return res.status(404).json({ error: "Ride request not found" });
    if (rideRequest.status !== "REQUESTED") {
      return res.status(409).json({ error: `Ride is already ${rideRequest.status}` });
    }

    // Concurrency-safe: acceptRideRequest does the atomic seat reservation
    // (Section 8). If two drivers/requests race for the last seat, only one
    // call here will succeed — the loser gets a 409.
    const { pool } = await acceptRideRequest(rideRequest, vehicle);

    const isPooled = pool.occupiedSeats > rideRequest.seatsRequested || (await prisma.poolMembership.count({ where: { poolId: pool.id } })) > 1;
    const farePaisa = calculateFarePaisa(rideRequest.destinationZone, isPooled);

    const updatedRide = await prisma.rideRequest.update({
      where: { id: rideRequest.id },
      data: { farePaisa },
    });

    const withHistory = await transitionRide(updatedRide, "MATCHED", req.user.id);

    res.json({ ride: withHistory, pool });
  } catch (err) {
    next(err);
  }
}

async function markArrived(req, res, next) {
  try {
    const ride = await getRideOwnedByDriver(req);
    const updated = await transitionRide(ride, "DRIVER_ARRIVED", req.user.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function markStarted(req, res, next) {
  try {
    const ride = await getRideOwnedByDriver(req);
    const updated = await transitionRide(ride, "STARTED", req.user.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function markCompleted(req, res, next) {
  try {
    const ride = await getRideOwnedByDriver(req);
    const updated = await transitionRide(ride, "COMPLETED", req.user.id);

    // Close out the pool if every member's ride is now finished/cancelled.
    const membership = await prisma.poolMembership.findUnique({
      where: { rideRequestId: ride.id },
      include: { pool: { include: { memberships: { include: { rideRequest: true } } } } },
    });
    if (membership) {
      const stillActive = membership.pool.memberships.some((m) =>
        ["REQUESTED", "MATCHED", "DRIVER_ARRIVED", "STARTED"].includes(m.rideRequest.status)
      );
      if (!stillActive) {
        await prisma.pool.update({ where: { id: membership.pool.id }, data: { status: "CLOSED" } });
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Loads a ride request and checks it belongs to a pool on this driver's vehicle.
async function getRideOwnedByDriver(req) {
  const vehicle = await getMyVehicle(req.user.id);
  const ride = await prisma.rideRequest.findUnique({
    where: { id: req.params.id },
    include: { membership: { include: { pool: true } } },
  });
  if (!ride) {
    const err = new Error("Ride request not found");
    err.status = 404;
    throw err;
  }
  if (!ride.membership || ride.membership.pool.vehicleId !== vehicle.id) {
    const err = new Error("This ride is not assigned to your vehicle");
    err.status = 403;
    throw err;
  }
  return ride;
}

module.exports = {
  setVehicleStatus,
  listRequests,
  listMyAssignedRides,
  acceptRequest,
  markArrived,
  markStarted,
  markCompleted,
};
