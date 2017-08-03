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

router.get('', isAuthenticated, listTeams)
router.post('', isAuthenticated, createTeam)
router.get('/:teamID', isAuthenticated, getTeam)
router.put('/:teamID', isAuthenticated, editTeam)
router.delete('/:teamID', isAuthenticated, deleteTeam)
router.put('/:teamID/avatar', isAuthenticated, uploadTeamAvatar)
router.put('/:teamID/leave', isAuthenticated, leaveTeam)

module.exports = router
