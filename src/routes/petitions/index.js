const express = require('express')

const { isAuthenticated } = require('../../helpers')

const createPetition = require('./create-petition')
const editPetition = require('./edit-petition')
const listPetitions = require('./list-petitions')

const router = new express.Router()

router.get('', isAuthenticated, listPetitions)
router.post('', isAuthenticated, createPetition)
router.put('/:petitionID', isAuthenticated, editPetition)

module.exports = router
