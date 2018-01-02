const express = require('express')

const { isAuthenticated } = require('../../helpers')

const createTeam = require('./create-team')
const deleteTeam = require('./delete-team')
const editTeam = require('./edit-team')
const getTeam = require('./get-team')
const leaveTeam = require('./leave-team')
const listTeams = require('./list-teams')
const uploadTeamAvatar = require('./upload-team-avatar')

const router = new express.Router()

router.get('', listTeams)
router.post('', isAuthenticated, createTeam)
router.get('/:teamId', getTeam)
router.put('/:teamId', isAuthenticated, editTeam)
router.delete('/:teamId', isAuthenticated, deleteTeam)
router.put('/:teamId/avatar', isAuthenticated, uploadTeamAvatar)
router.put('/:teamId/leave', isAuthenticated, leaveTeam)

module.exports = router
