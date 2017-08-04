const express = require('express')

const { isAuthenticated } = require('../../helpers')

const activateAccount = require('./activate-account')
const forgottenPassword = require('./forgotten-password')
const generateToken = require('./generate-token')
const resetPassword = require('./reset-password')
const signIn = require('./sign-in')
const signOut = require('./sign-out')
const signUp = require('./sign-up')

const router = new express.Router()

router.get('/activate-account/:key', activateAccount)
router.post('/forgotten-password', forgottenPassword)
router.post('/token', generateToken)
router.put('/reset-password', resetPassword)
router.post('/sign-in', signIn)
router.delete('/sign-out', isAuthenticated, signOut)
router.post('/sign-up', signUp)

module.exports = router
