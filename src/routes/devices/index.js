const express = require("express");
const router = express.Router();

const registerDevice = require("./register-device");

router.post("/register", registerDevice);

module.exports = router;
