const express = require('express')

const { isAuthenticated } = require('../../helpers')

const createTeam = require('./create-team')
const deleteTeam = require('./delete-team')
const editTeam = require('./edit-team')
const getTeam = require('./get-team')
const joinTeam = require('./join-team')
const leaveTeam = require('./leave-team')
const listTeams = require('./list-teams')

const router = new express.Router()

router.get('', isAuthenticated({ isOptional: true }), listTeams)
router.post('', isAuthenticated({ isOptional: false }), createTeam)
router.get('/:teamId', getTeam)
router.put('/:teamId', isAuthenticated({ isOptional: false }), editTeam)
router.delete('/:teamId', isAuthenticated({ isOptional: false }), deleteTeam)
router.post('/:teamId/join', isAuthenticated({ isOptional: false }), joinTeam)
router.put('/:teamId/leave', isAuthenticated({ isOptional: false }), leaveTeam)

module.exports = router
