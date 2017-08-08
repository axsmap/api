const express = require('express')

const { isAuthenticated } = require('../../helpers')

const archiveUser = require('./archive-user')
const blockUser = require('./block-user')
const changePassword = require('./change-password')
const createUser = require('./create-user')
const deleteUser = require('./delete-user')
const editUser = require('./edit-user')
const getUser = require('./get-user')
const listUsers = require('./list-users')
const unblockUser = require('./unblock-user')
const uploadUserAvatar = require('./upload-user-avatar')

const router = new express.Router()

router.put('/password', isAuthenticated, changePassword)
router.get('', isAuthenticated, listUsers)
router.post('', isAuthenticated, createUser)
router.get('/:userID', isAuthenticated, getUser)
router.put('/:userID', isAuthenticated, editUser)
router.delete('/:userID', isAuthenticated, deleteUser)
router.put('/:userID/avatar', isAuthenticated, uploadUserAvatar)
router.put('/:userID/archive', isAuthenticated, archiveUser)
router.put('/:userID/block', isAuthenticated, blockUser)
router.put('/:userID/unblock', isAuthenticated, unblockUser)

module.exports = router
