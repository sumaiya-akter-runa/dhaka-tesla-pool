const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const jashim = await prisma.user.upsert({
    where: { email: "jashim@teslapool.dhaka" },
    update: {},
    create: {
      name: "Jashim",
      email: "jashim@teslapool.dhaka",
      passwordHash,
      role: "DRIVER",
    },
  });

  const bullet = await prisma.vehicle.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      driverId: jashim.id,
      name: "Bullet",
      capacity: 3,
      status: "ONLINE",
    },
  });

  const passengers = [
    { name: "Nusrat", email: "nusrat@teslapool.dhaka" },
    { name: "Rafiq", email: "rafiq@teslapool.dhaka" },
    { name: "Shirin", email: "shirin@teslapool.dhaka" },
  ];

  for (const p of passengers) {
    await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: { name: p.name, email: p.email, passwordHash, role: "PASSENGER" },
    });
  }

  console.log("Seeded:");
  console.log(`  Driver:     Jashim <jashim@teslapool.dhaka> / ${DEMO_PASSWORD}`);
  console.log(`  Vehicle:    Bullet (${bullet.capacity} seats), id=${bullet.id}`);
  console.log(`  Passengers: Nusrat, Rafiq, Shirin — all password ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
