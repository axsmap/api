const express = require("express");

const { isAuthenticated } = require("../../helpers");

const listInvites = require("./list-invites");
const createInvite = require("./create-invite");

const router = new express.Router();

router.get("", isAuthenticated({ isOptional: false }), listInvites);
router.post("", isAuthenticated({ isOptional: false }), createInvite);

module.exports = router;
