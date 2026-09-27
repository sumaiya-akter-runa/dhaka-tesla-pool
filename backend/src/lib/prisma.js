const { PrismaClient } = require("@prisma/client");

// A single shared Prisma client instance (avoids exhausting DB connections
// with one client per request, and avoids hot-reload duplication in dev).
const prisma = new PrismaClient();

module.exports = prisma;
