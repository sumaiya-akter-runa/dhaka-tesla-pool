const express = require("express");
const { register, login, me } = require("../controllers/authController");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../validators/schemas");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, me);

module.exports = router;
