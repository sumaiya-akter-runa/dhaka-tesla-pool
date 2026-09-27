const prisma = require("../lib/prisma");
const { destinationsCompatible } = require("../lib/zones");

/**
 * Section 6 matching rule: a ride request can join an existing OPEN pool on
 * a vehicle iff pickupZone matches and destinationZone is compatible and
 * there's room in that specific pool.
 */
async function findCompatiblePool(tx, vehicleId, pickupZone, destinationZone, seatsRequested, capacity) {
  const openPools = await tx.pool.findMany({
    where: { vehicleId, status: "OPEN", pickupZone },
  });

  return (
    openPools.find(
      (pool) =>
        destinationsCompatible(pool.destinationZone, destinationZone) &&
        pool.occupiedSeats + seatsRequested <= capacity
    ) || null
  );
}

/**
 * Driver-accept flow, and the fix for Section 8's last-seat problem.
 *
 * Everything happens inside one transaction that starts by locking the
 * vehicle row (`SELECT ... FOR UPDATE`). That serializes every concurrent
 * accept for this vehicle, which does two things at once:
 *   1. Prevents the classic "two requests both see 1 seat free" race.
 *   2. Prevents a subtler bug: capacity was previously checked per-pool, so
 *      a vehicle with two open pools for different (non-compatible) routes
 *      could seat up to `capacity` passengers in EACH pool — more people
 *      than the physical vehicle actually holds. We now sum occupied seats
 *      across every active pool on the vehicle and check that total.
 */
async function acceptRideRequest(rideRequest, vehicle) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicle.id}::uuid FOR UPDATE`;

    const freshVehicle = await tx.vehicle.findUnique({ where: { id: vehicle.id } });
    if (!freshVehicle || freshVehicle.status !== "ONLINE") {
      const err = new Error("Vehicle is not online");
      err.status = 409;
      throw err;
    }
    if (rideRequest.seatsRequested > freshVehicle.capacity) {
      const err = new Error("Vehicle does not have enough seats");
      err.status = 409;
      throw err;
    }

    const activePools = await tx.pool.findMany({
      where: { vehicleId: freshVehicle.id, status: { in: ["OPEN", "FULL"] } },
    });
    const totalOccupied = activePools.reduce((sum, p) => sum + p.occupiedSeats, 0);
    if (totalOccupied + rideRequest.seatsRequested > freshVehicle.capacity) {
      const err = new Error("Pool is full — the vehicle doesn't have that many free seats");
      err.status = 409;
      throw err;
    }

    let pool = await findCompatiblePool(
      tx,
      freshVehicle.id,
      rideRequest.pickupZone,
      rideRequest.destinationZone,
      rideRequest.seatsRequested,
      freshVehicle.capacity
    );

    if (!pool) {
      pool = await tx.pool.create({
        data: {
          vehicleId: freshVehicle.id,
          pickupZone: rideRequest.pickupZone,
          destinationZone: rideRequest.destinationZone,
          status: "OPEN",
          occupiedSeats: 0,
        },
      });
    }

    const updatedPool = await tx.pool.update({
      where: { id: pool.id },
      data: {
        occupiedSeats: { increment: rideRequest.seatsRequested },
        status: pool.occupiedSeats + rideRequest.seatsRequested >= freshVehicle.capacity ? "FULL" : "OPEN",
      },
    });

    const membership = await tx.poolMembership.create({
      data: {
        poolId: pool.id,
        rideRequestId: rideRequest.id,
        seats: rideRequest.seatsRequested,
      },
    });

    return { pool: updatedPool, membership };
  });
}

module.exports = { findCompatiblePool, acceptRideRequest };