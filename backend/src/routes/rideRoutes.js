const express = require("express");
const { createRide, listMyRides, getRide, cancelRide } = require("../controllers/rideController");
const validate = require("../middleware/validate");
const { createRideRequestSchema } = require("../validators/schemas");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, requireRole("PASSENGER"), validate(createRideRequestSchema), createRide);
router.get("/my", requireAuth, requireRole("PASSENGER"), listMyRides);
router.get("/:id", requireAuth, getRide);
router.post("/:id/cancel", requireAuth, requireRole("PASSENGER"), cancelRide);

module.exports = router;
