const express = require('express')

const { isAuthenticated } = require('../../helpers')

const activateAccount = require('./activate-account')
const facebookSignIn = require('./facebook-sign-in')
const forgottenPassword = require('./forgotten-password')
const generateToken = require('./generate-token')
const googleSignIn = require('./google-sign-in')
const resetPassword = require('./reset-password')
const signIn = require('./sign-in')
const signOut = require('./sign-out')
const signUp = require('./sign-up')

const router = new express.Router()

router.get('/activate-account/:key', activateAccount)
router.post('/facebook', facebookSignIn)
router.post('/forgotten-password', forgottenPassword)
router.post('/google', googleSignIn)
router.put('/reset-password', resetPassword)
router.post('/sign-in', signIn)
router.delete('/sign-out', isAuthenticated({ isOptional: false }), signOut)
router.post('/sign-up', signUp)
router.post('/token', generateToken)

module.exports = router
