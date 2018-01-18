const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const createPetition = require('./create-petition')
const editPetition = require('./edit-petition')
const listPetitions = require('./list-petitions')

const router = new express.Router()

router.get('', isAuthenticated, isUnblocked, listPetitions)
router.post('', isAuthenticated, isUnblocked, createPetition)
router.put('/:petitionId', isAuthenticated, isUnblocked, editPetition)

module.exports = router
