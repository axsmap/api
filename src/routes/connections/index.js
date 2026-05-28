const express = require('express');

const { isAuthenticated } = require('../../helpers');

const createConnection = require('./create-connection');
const deleteConnection = require('./delete-connection');
const editConnection = require('./edit-connection');
const listConnections = require('./list-connections');

const router = new express.Router();

router.get('', isAuthenticated({ isOptional: false }), listConnections);
router.post('', isAuthenticated({ isOptional: false }), createConnection);
router.put(
  '/:connectionId',
  isAuthenticated({ isOptional: false }),
  editConnection
);
router.delete(
  '/:connectionId',
  isAuthenticated({ isOptional: false }),
  deleteConnection
);

module.exports = router;
