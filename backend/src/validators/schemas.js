const { z } = require("zod");
const { ZONES } = require("../lib/zones");

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["PASSENGER", "DRIVER"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const zoneEnum = z.enum(ZONES);

const createRideRequestSchema = z.object({
  pickupZone: zoneEnum,
  destinationZone: zoneEnum,
  seatsRequested: z.number().int().min(1).max(3).default(1),
});

module.exports = { registerSchema, loginSchema, createRideRequestSchema };
