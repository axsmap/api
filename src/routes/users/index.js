const express = require('express');

const { isAuthenticated } = require('../../helpers');

const archiveUser = require('./archive-user');
const blockConnectedUser = require('./block-connected-user');
const blockUser = require('./block-user');
const changePassword = require('./change-password');
const createUser = require('./create-user');
const deleteUser = require('./delete-user');
const editUser = require('./edit-user');
const getUser = require('./get-user');
const getOverallLeaderboard = require('../events/get-overall-leaderboard');
const getProfile = require('./get-profile');
const listUsers = require('./list-users');
const markOpened = require('./mark-opened');
const unblockUser = require('./unblock-user');
const unblockConnectedUser = require('./unblock-connected-user');
const deactivateUser = require('./deactivate-user');

const router = new express.Router();

router.get('/profile', isAuthenticated({ isOptional: false }), getProfile);
router.get('/leaderboard', getOverallLeaderboard);
router.put('/opened', isAuthenticated({ isOptional: false }), markOpened);
router.put('/password', isAuthenticated({ isOptional: false }), changePassword);
router.get('', isAuthenticated({ isOptional: false }), listUsers);
router.post('', isAuthenticated({ isOptional: false }), createUser);
router.get('/:userId', getUser);
router.put('/:userId', isAuthenticated({ isOptional: false }), editUser);
router.delete(
  '/deactivate',
  isAuthenticated({ isOptional: false }),
  deactivateUser
);
router.delete('/:userId', isAuthenticated({ isOptional: false }), deleteUser);
router.put(
  '/:userId/archive',
  isAuthenticated({ isOptional: false }),
  archiveUser
);
router.put('/:userId/block', isAuthenticated({ isOptional: false }), blockUser);
router.put(
  '/:userId/block-connection',
  isAuthenticated({ isOptional: false }),
  blockConnectedUser
);
router.put(
  '/:userId/unblock',
  isAuthenticated({ isOptional: false }),
  unblockUser
);
router.put(
  '/:userId/unblock-connection',
  isAuthenticated({ isOptional: false }),
  unblockConnectedUser
);

module.exports = router;
