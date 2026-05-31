const express = require("express");

const { isAuthenticated } = require("../../helpers");

const listConnections = require("./list-connections");
const createConnection = require("./create-connection");
const respondConnection = require("./respond-connection");
const deleteConnection = require("./delete-connection");

const router = new express.Router();

router.get("", isAuthenticated({ isOptional: false }), listConnections);
router.post("", isAuthenticated({ isOptional: false }), createConnection);
router.put("/:id", isAuthenticated({ isOptional: false }), respondConnection);
router.delete("/:id", isAuthenticated({ isOptional: false }), deleteConnection);

module.exports = router;
