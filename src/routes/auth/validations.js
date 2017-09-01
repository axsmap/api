const freemail = require('freemail')
const { isEmail } = require('validator')
const { isEmpty } = require('lodash')
const { trim } = require('lodash')

module.exports = {
  validateFacebookSignIn(data) {
    const errors = {}

    if (!data.accessToken) {
      errors.accessToken = 'Is required'
    } else if (typeof data.accessToken !== 'string') {
      errors.accessToken = 'Should be a string'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateForgottenPassword(data) {
    const errors = {}

    if (!data.email) {
      errors.email = 'Is required'
    } else if (typeof data.email !== 'string') {
      errors.email = 'Should be a string'
    } else if (!isEmail(data.email)) {
      errors.email = 'Should be a valid email'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateGenerateToken(data) {
    const errors = {}

    if (!data.key) {
      errors.key = 'Is required'
    } else if (typeof data.key !== 'string') {
      errors.key = 'Should be a string'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateGoogleSignIn(data) {
    const errors = {}

    if (!data.code) {
      errors.code = 'Is required'
    } else if (typeof data.code !== 'string') {
      errors.code = 'Should be a string'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateResetPassword(data) {
    const errors = {}

    if (!data.key) {
      errors.key = 'Is required'
    } else if (typeof data.key !== 'string') {
      errors.key = 'Should be a string'
    }

    if (!data.password) {
      errors.password = 'Is required'
    } else if (typeof data.password !== 'string') {
      errors.password = 'Should be a string'
    } else if (data.password.length < 8) {
      errors.password = 'Should have more than 7 characters'
    } else if (data.password.length > 30) {
      errors.password = 'Should have less than 31 characters'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateSignIn(data) {
    const errors = {}

    if (!data.email) {
      errors.email = 'Is required'
    } else if (typeof data.email !== 'string') {
      errors.email = 'Should be a string'
    }

    if (!data.password) {
      errors.password = 'Is required'
    } else if (typeof data.password !== 'string') {
      errors.password = 'Should be a string'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateSignUp(data) {
    const errors = {}

    if (!data.email) {
      errors.email = 'Is required'
    } else if (typeof data.email !== 'string') {
      errors.email = 'Should be a string'
    } else if (trim(data.email).length > 254) {
      errors.email = 'Should have less than 255 characters'
    } else if (!isEmail(data.email) || freemail.isDisposable(data.email)) {
      errors.email = 'Should be a valid email'
    }

    if (!data.firstName) {
      errors.firstName = 'Is required'
    } else if (typeof data.firstName !== 'string') {
      errors.firstName = 'Should be a string'
    } else if (/[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.firstName)) {
      errors.firstName = 'Should only have letters'
    } else if (trim(data.firstName).length > 24) {
      errors.firstName = 'Should have less than 25 characters'
    } else {
      const firstName = trim(data.firstName)

      if (firstName.split(' ').length > 1) {
        errors.firstName = 'Should only be one name'
      }
    }

    if (typeof data.isSubscribed === 'undefined') {
      errors.isSubscribed = 'Is required'
    } else if (typeof data.isSubscribed !== 'boolean') {
      errors.isSubscribed = 'Should be a boolean'
    }

    if (!data.lastName) {
      errors.lastName = 'Is required'
    } else if (typeof data.lastName !== 'string') {
      errors.lastName = 'Should be a string'
    } else if (/[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.lastName)) {
      errors.lastName = 'Should only have letters'
    } else if (trim(data.lastName).length > 36) {
      errors.lastName = 'Should have less than 37 characters'
    } else {
      const lastName = trim(data.lastName)

      if (lastName.split(' ').length > 1) {
        errors.lastName = 'Should only be one surname'
      }
    }

    if (!data.password) {
      errors.password = 'Is required'
    } else if (typeof data.password !== 'string') {
      errors.password = 'Should be a string'
    } else if (data.password.length < 8) {
      errors.password = 'Should have more than 7 characters'
    } else if (data.password.length > 30) {
      errors.password = 'Should have less than 31 characters'
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
