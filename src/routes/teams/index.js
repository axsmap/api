const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const createTeam = require('./create-team')
const deleteTeam = require('./delete-team')
const editTeam = require('./edit-team')
const getTeam = require('./get-team')
const leaveTeam = require('./leave-team')
const listTeams = require('./list-teams')
const uploadTeamAvatar = require('./upload-team-avatar')

const router = new express.Router()

router.get(
  '',
  isAuthenticated({ isOptional: true }),
  isUnblocked({ isOptional: true }),
  listTeams
)
router.post(
  '',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  createTeam
)
router.get('/:teamId', getTeam)
router.put(
  '/:teamId',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  editTeam
)
router.delete('/:teamId', isAuthenticated({ isOptional: false }), deleteTeam)
router.put(
  '/:teamId/avatar',
  isAuthenticated({ isOptional: false }),
  uploadTeamAvatar
)
router.put('/:teamId/leave', isAuthenticated({ isOptional: false }), leaveTeam)

module.exports = router
