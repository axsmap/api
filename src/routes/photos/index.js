const express = require('express')

const { isAuthenticated } = require('../../helpers')

const createPhoto = require('./create-photo')
const deletePhoto = require('./delete-photo')

const router = new express.Router()

router.post('', isAuthenticated({ isOptional: false }), createPhoto)
router.delete(
  '/:photoFileName',
  isAuthenticated({ isOptional: false }),
  deletePhoto
)

module.exports = router
