const express = require('express');

const { isAuthenticated } = require('../../helpers');

const createConnection = require('./create-connection');
const deleteConnection = require('./delete-connection');
const editConnection = require('./edit-connection');
const listConnections = require('./list-connections');
const listMessages = require('../messages/list-messages');
const markMessagesRead = require('../messages/mark-messages-read');
const unreadMessageCount = require('../messages/unread-count');

const router = new express.Router();

router.get('', isAuthenticated({ isOptional: false }), listConnections);
router.post('', isAuthenticated({ isOptional: false }), createConnection);

router.get(
  '/messages/unread-count',
  isAuthenticated({ isOptional: false }),
  unreadMessageCount
);

router.get(
  '/:connectionId/messages',
  isAuthenticated({ isOptional: false }),
  listMessages
);

router.post(
  '/:connectionId/messages/read',
  isAuthenticated({ isOptional: false }),
  markMessagesRead
);

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
