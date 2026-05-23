const express = require('express');

const { isAuthenticated } = require('../../helpers');

const archiveUser = require('./archive-user');
const blockUser = require('./block-user');
const changePassword = require('./change-password');
const createUser = require('./create-user');
const deleteUser = require('./delete-user');
const editUser = require('./edit-user');
const getUser = require('./get-user');
const getUserBadges = require('./get-user-badges');
const getUserByUsername = require('./get-user-by-username');
const getProfile = require('./get-profile');
const leaderboard = require('./leaderboard');
const suppressUserBadge = require('./suppress-user-badge');
const listUsers = require('./list-users');
const unblockUser = require('./unblock-user');
const deactivateUser = require('./deactivate-user');
const reactivateAccount = require('../auth/reactivate-account');

const router = new express.Router();

router.get('/profile', isAuthenticated({ isOptional: false }), getProfile);
router.get('/leaderboard', leaderboard);
router.get('/by-username/:username', getUserByUsername);
router.put('/password', isAuthenticated({ isOptional: false }), changePassword);
router.get('', isAuthenticated({ isOptional: false }), listUsers);
router.post('', isAuthenticated({ isOptional: false }), createUser);
router.get('/:userId', getUser);
router.get(
  '/:userId/badges',
  isAuthenticated({ isOptional: true }),
  getUserBadges
);
router.post(
  '/:userId/badges/:badgeId/suppress',
  isAuthenticated({ isOptional: false }),
  suppressUserBadge
);
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
  '/:userId/unblock',
  isAuthenticated({ isOptional: false }),
  unblockUser
);

// Legacy route for frontend compatibility - redirects to /auth/reactivate-account
router.post('/reactivate', reactivateAccount);

module.exports = router;
