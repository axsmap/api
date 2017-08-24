const express = require('express')
const ExpressBrute = require('express-brute')
const MongooseStore = require('express-brute-mongoose')

const { isAuthenticated } = require('../../helpers')
const BruteForce = require('../../models/brute-force')

const activateAccount = require('./activate-account')
const forgottenPassword = require('./forgotten-password')
const generateToken = require('./generate-token')
const resetPassword = require('./reset-password')
const signIn = require('./sign-in')
const signOut = require('./sign-out')
const signUp = require('./sign-up')

const router = new express.Router()
const store = new MongooseStore(BruteForce)
const bruteforce = new ExpressBrute(store, { freeRetries: 10 })

router.get('/activate-account/:key', activateAccount)
router.post('/forgotten-password', bruteforce.prevent, forgottenPassword)
router.post('/token', bruteforce.prevent, generateToken)
router.put('/reset-password', bruteforce.prevent, resetPassword)
router.post('/sign-in', bruteforce.prevent, signIn)
router.delete('/sign-out', isAuthenticated, signOut)
router.post('/sign-up', bruteforce.prevent, signUp)

module.exports = router
