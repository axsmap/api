const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const createPetition = require('./create-petition')

const router = new express.Router()

router.post('', isAuthenticated, isUnblocked, createPetition)

module.exports = router
