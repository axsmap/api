const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const createPetition = require('./create-petition')
const editPetition = require('./edit-petition')
const listPetitions = require('./list-petitions')

const router = new express.Router()

router.get(
  '',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  listPetitions
)
router.post(
  '',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  createPetition
)
router.put(
  '/:petitionId',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  editPetition
)

module.exports = router
