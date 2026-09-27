const express = require("express");
const {
  setVehicleStatus,
  listRequests,
  listMyAssignedRides,
  acceptRequest,
  markArrived,
  markStarted,
  markCompleted,
} = require("../controllers/driverController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("DRIVER"));

router.post("/vehicle/status", setVehicleStatus);
router.get("/rides/requests", listRequests);
router.get("/rides/mine", listMyAssignedRides);
router.post("/rides/:id/accept", acceptRequest);
router.post("/rides/:id/arrived", markArrived);
router.post("/rides/:id/start", markStarted);
router.post("/rides/:id/complete", markCompleted);

module.exports = router;
