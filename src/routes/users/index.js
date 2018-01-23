const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const archiveUser = require('./archive-user')
const blockUser = require('./block-user')
const changePassword = require('./change-password')
const createUser = require('./create-user')
const deleteUser = require('./delete-user')
const editUser = require('./edit-user')
const getUser = require('./get-user')
const getProfile = require('./get-profile')
const listUsers = require('./list-users')
const unblockUser = require('./unblock-user')
const uploadUserAvatar = require('./upload-user-avatar')

const router = new express.Router()

router.get('/profile', isAuthenticated, isUnblocked, getProfile)
router.put('/password', isAuthenticated, changePassword)
router.get('', isAuthenticated, isUnblocked, listUsers)
router.post('', isAuthenticated, createUser)
router.get('/:userId', isAuthenticated, getUser)
router.put('/:userId', isAuthenticated, editUser)
router.delete('/:userId', isAuthenticated, deleteUser)
router.put('/:userId/avatar', isAuthenticated, uploadUserAvatar)
router.put('/:userId/archive', isAuthenticated, archiveUser)
router.put('/:userId/block', isAuthenticated, blockUser)
router.put('/:userId/unblock', isAuthenticated, unblockUser)

module.exports = router
