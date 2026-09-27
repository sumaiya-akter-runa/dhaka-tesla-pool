// These tests hit a real Postgres database via Prisma, so they need
// DATABASE_URL pointed at a test database (see backend/.env.example and
// docker-compose.yml). Run with: npm test -- integration
// If no DATABASE_URL is configured, the suite is skipped rather than failing
// the whole run, so `npm test` still works out of the box for the unit tests.

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("integration: capacity, concurrency, ownership", () => {
  let request, app, prisma, jashim, bullet, nusrat, rafiq, shirin;

  beforeAll(async () => {
    request = require("supertest");
    app = require("../src/app");
    prisma = require("../src/lib/prisma");

    // Reset relevant tables for a clean run.
    await prisma.rideStatusHistory.deleteMany();
    await prisma.poolMembership.deleteMany();
    await prisma.pool.deleteMany();
    await prisma.rideRequest.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();

    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash("password123", 10);

    jashim = await prisma.user.create({
      data: { name: "Jashim", email: "jashim@test.local", passwordHash: hash, role: "DRIVER" },
    });
    bullet = await prisma.vehicle.create({
      data: { driverId: jashim.id, name: "Bullet", capacity: 3, status: "ONLINE" },
    });
    nusrat = await prisma.user.create({
      data: { name: "Nusrat", email: "nusrat@test.local", passwordHash: hash, role: "PASSENGER" },
    });
    rafiq = await prisma.user.create({
      data: { name: "Rafiq", email: "rafiq@test.local", passwordHash: hash, role: "PASSENGER" },
    });
    shirin = await prisma.user.create({
      data: { name: "Shirin", email: "shirin@test.local", passwordHash: hash, role: "PASSENGER" },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function tokenFor(user) {
    const jwt = require("jsonwebtoken");
    return jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET);
  }

  test("Bullet's capacity (3 seats) is never exceeded", async () => {
    const driverToken = tokenFor(jashim);

    // Fill the vehicle to capacity with 3 solo requests.
    const riders = [nusrat, rafiq, shirin];
    for (const rider of riders) {
      const riderToken = tokenFor(rider);
      const createRes = await request(app)
        .post("/api/rides")
        .set("Authorization", `Bearer ${riderToken}`)
        .send({ pickupZone: "Banani", destinationZone: "Mohakhali", seatsRequested: 1 });
      expect(createRes.status).toBe(201);

      const acceptRes = await request(app)
        .post(`/api/driver/rides/${createRes.body.id}/accept`)
        .set("Authorization", `Bearer ${driverToken}`);
      expect(acceptRes.status).toBe(200);
    }

    const pool = await prisma.pool.findFirst({ where: { vehicleId: bullet.id } });
    expect(pool.occupiedSeats).toBe(3);
    expect(pool.status).toBe("FULL");

    // A 4th request should fail to accept — no room left.
    const extra = await prisma.user.create({
      data: {
        name: "Extra",
        email: "extra@test.local",
        passwordHash: (await prisma.user.findUnique({ where: { id: nusrat.id } })).passwordHash,
        role: "PASSENGER",
      },
    });
    const extraToken = tokenFor(extra);
    const extraCreate = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${extraToken}`)
      .send({ pickupZone: "Banani", destinationZone: "Mohakhali", seatsRequested: 1 });

    const extraAccept = await request(app)
      .post(`/api/driver/rides/${extraCreate.body.id}/accept`)
      .set("Authorization", `Bearer ${driverToken}`);

    // Either a new pool can't form (vehicle full) or the existing pool
    // rejects the join — either way it must not exceed capacity.
    const poolsAfter = await prisma.pool.findMany({ where: { vehicleId: bullet.id } });
    const totalOccupied = poolsAfter.reduce((sum, p) => sum + p.occupiedSeats, 0);
    expect(totalOccupied).toBeLessThanOrEqual(bullet.capacity);
    void extraAccept;
  });

  test("a passenger cannot view another passenger's ride", async () => {
    const nusratToken = tokenFor(nusrat);
    const rafiqToken = tokenFor(rafiq);

    const created = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${nusratToken}`)
      .send({ pickupZone: "Dhanmondi", destinationZone: "Farmgate", seatsRequested: 1 });

    const asRafiq = await request(app)
      .get(`/api/rides/${created.body.id}`)
      .set("Authorization", `Bearer ${rafiqToken}`);

    expect(asRafiq.status).toBe(403);
  });

  test("two simultaneous last-seat requests result in exactly one success", async () => {
    // Fresh vehicle with exactly 1 seat left.
    const solo = await prisma.vehicle.create({
      data: { driverId: jashim.id, name: "LastSeatCar", capacity: 1, status: "ONLINE" },
    });
    void solo;

    const driverToken = tokenFor(jashim);

    // Two new passengers race for the same 1-seat vehicle by both hitting
    // accept on their own ride requests concurrently. To simulate "both saw
    // 1 seat free", create two separate ride requests for the same
    // pickup/destination and accept them concurrently — only one can win the
    // underlying pool's seat because pool capacity is bound to the vehicle,
    // not the request.
    const a = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${tokenFor(nusrat)}`)
      .send({ pickupZone: "Uttara", destinationZone: "Mirpur", seatsRequested: 1 });
    const b = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${tokenFor(rafiq)}`)
      .send({ pickupZone: "Uttara", destinationZone: "Mirpur", seatsRequested: 1 });

    // Point both at a 1-seat vehicle by driving through a fresh driver.
    const otherDriver = await prisma.user.create({
      data: {
        name: "OtherDriver",
        email: "otherdriver@test.local",
        passwordHash: (await prisma.user.findUnique({ where: { id: jashim.id } })).passwordHash,
        role: "DRIVER",
      },
    });
    await prisma.vehicle.create({
      data: { driverId: otherDriver.id, name: "TinyCar", capacity: 1, status: "ONLINE" },
    });
    const otherDriverToken = tokenFor(otherDriver);

    const [resA, resB] = await Promise.all([
      request(app).post(`/api/driver/rides/${a.body.id}/accept`).set("Authorization", `Bearer ${otherDriverToken}`),
      request(app).post(`/api/driver/rides/${b.body.id}/accept`).set("Authorization", `Bearer ${otherDriverToken}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // One succeeds (200), one is rejected as full (409).
    expect(statuses).toEqual([200, 409]);
    void driverToken;
  });
});
