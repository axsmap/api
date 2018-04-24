const freemail = require('freemail')
const { isEmail, isInt } = require('validator')
const { isEmpty } = require('lodash')
const slugify = require('speakingurl')

const { cleanSpaces } = require('../../helpers')
const { User } = require('../../models/user')

module.exports = {
  validateChangePassword(data) {
    const errors = {}

    if (!data.oldPassword) {
      errors.oldPassword = 'Is required'
    } else if (typeof data.oldPassword !== 'string') {
      errors.oldPassword = 'Should be a string'
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
  validateCreateUser(data) {
    const errors = {}

    if (data.description) {
      if (typeof data.description !== 'string') {
        errors.description = 'Should be a string'
      } else if (cleanSpaces(data.description).length > 2000) {
        errors.description = 'Should have less than 2001 characters'
      }
    }

    if (!data.email) {
      errors.email = 'Is required'
    } else if (typeof data.email !== 'string') {
      errors.email = 'Should be a string'
    } else if (cleanSpaces(data.email).length > 254) {
      errors.email = 'Should have less than 255 characters'
    } else if (!isEmail(data.email) || freemail.isDisposable(data.email)) {
      errors.email = 'Is not a valid email'
    }

    if (!data.firstName) {
      errors.firstName = 'Is required'
    } else if (typeof data.firstName !== 'string') {
      errors.firstName = 'Should be a string'
    } else if (/[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.firstName)) {
      errors.firstName = 'Should only have letters'
    } else if (cleanSpaces(data.firstName).length > 24) {
      errors.firstName = 'Should have less than 25 characters'
    } else {
      const firstName = cleanSpaces(data.firstName)

      if (firstName.split(' ').length > 1) {
        errors.firstName = 'Should only be one name'
      }
    }

    if (!data.lastName) {
      errors.lastName = 'Is required'
    } else if (typeof data.lastName !== 'string') {
      errors.lastName = 'Should be a string'
    } else if (/[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.lastName)) {
      errors.lastName = 'Should only have letters'
    } else if (cleanSpaces(data.lastName).length > 36) {
      errors.lastName = 'Should have less than 37 characters'
    } else {
      const lastName = cleanSpaces(data.lastName)

      if (lastName.split(' ').length > 1) {
        errors.lastName = 'Should only be one last name'
      }
    }

    if (!data.password) {
      errors.password = 'Is required'
    } else if (typeof data.password !== 'string') {
      errors.password = 'Should be a string'
    } else if (data.password.length < 8) {
      errors.password = 'Should be more than 7 characters'
    } else if (data.password.length > 30) {
      errors.password = 'Should be less than 31 characters'
    }

    if (data.phone) {
      if (typeof data.phone !== 'string') {
        errors.phone = 'Should be a string'
      } else if (cleanSpaces(data.phone).length > 50) {
        errors.phone = 'Should have less than 51 characters'
      }
    }

    if (data.username) {
      if (typeof data.username !== 'string') {
        errors.username = 'Should be a string'
      } else if (cleanSpaces(data.username).length > 67) {
        errors.username = 'Should have less than 68 characters'
      } else {
        const username = slugify(data.username)

        if (username !== data.username) {
          errors.username = 'Should only have lowercase letters and hyphens'
        }
      }
    }

    if (data.zip) {
      if (typeof data.zip !== 'string') {
        errors.zip = 'Should be a string'
      } else if (cleanSpaces(data.zip).length > 32) {
        errors.zip = 'Should have less than 33 characters'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateEditUser(data) {
    const errors = {}

    if (typeof data.avatar !== 'undefined' && typeof data.avatar !== 'string') {
      errors.avatar = 'Should be a string'
    }

    if (
      typeof data.description !== 'undefined' &&
      typeof data.description !== 'string'
    ) {
      errors.description = 'Should be a string'
    }

    if (typeof data.disabilities !== 'undefined') {
      if (!Array.isArray(data.disabilities)) {
        errors.disabilities = 'Should be an array'
      } else {
        const disabilitiesTypes = [
          'brain',
          'cognitive',
          'hearing',
          'invisible',
          'none',
          'other',
          'physical',
          'private',
          'psychological',
          'spinal-cord',
          'vision'
        ]
        data.disabilities.some(d => {
          if (typeof d !== 'string') {
            errors.disabilities = 'All values should be strings'
            return true
          } else if (!disabilitiesTypes.includes(d)) {
            errors.disabilities = 'All values should be valid disabilities'
            return true
          }
        })
      }
    }

    if (typeof data.firstName !== 'undefined') {
      if (typeof data.firstName !== 'string') {
        errors.firstName = 'Should be a string'
      } else if (data.firstName === '') {
        errors.firstName = 'Is required'
      } else if (
        /[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.firstName)
      ) {
        errors.firstName = 'Should only have letters'
      } else {
        const firstName = cleanSpaces(data.firstName)

        if (firstName.split(' ').length > 1) {
          errors.firstName = 'Should only be one first name'
        }
      }
    }

    if (typeof data.gender !== 'undefined') {
      const gendersTypes = User.schema.path('gender').enumValues
      if (typeof data.gender !== 'string') {
        errors.gender = 'Should be a string'
      } else if (data.gender === '') {
        errors.gender = 'Is required'
      } else if (!gendersTypes.includes(data.gender)) {
        errors.gender = 'Should be a valid gender'
      }
    }

    if (
      typeof data.isSubscribed !== 'undefined' &&
      typeof data.isSubscribed !== 'boolean'
    ) {
      errors.isSubscribed = 'Should be a boolean'
    }

    if (typeof data.lastName !== 'undefined') {
      if (typeof data.lastName !== 'string') {
        errors.lastName = 'Should be a string'
      } else if (data.lastName === '') {
        errors.lastName = 'Is required'
      } else if (/[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.lastName)) {
        errors.lastName = 'Should only have letters'
      } else {
        const lastName = cleanSpaces(data.lastName)

        if (lastName.split(' ').length > 1) {
          errors.lastName = 'Should only be one last name'
        }
      }
    }

    if (typeof data.phone !== 'undefined' && typeof data.phone !== 'string') {
      errors.phone = 'Should be a string'
    }

    if (
      typeof data.showDisabilities !== 'undefined' &&
      typeof data.showDisabilities !== 'boolean'
    ) {
      errors.showDisabilities = 'Should be a boolean'
    }

    if (
      typeof data.showEmail !== 'undefined' &&
      typeof data.showEmail !== 'boolean'
    ) {
      errors.showEmail = 'Should be a boolean'
    }

    if (
      typeof data.showPhone !== 'undefined' &&
      typeof data.showPhone !== 'boolean'
    ) {
      errors.showPhone = 'Should be a boolean'
    }

    if (typeof data.username !== 'undefined') {
      if (typeof data.username !== 'string') {
        errors.username = 'Should be a string'
      } else if (data.username === '') {
        errors.username = 'Is required'
      } else {
        const username = slugify(data.username)

        if (username !== data.username) {
          errors.username = 'Should only have lowercase letters and hyphens'
        }
      }
    }

    if (typeof data.zip !== 'undefined' && typeof data.zip !== 'string') {
      errors.zip = 'Should be a string'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateListUsers(queryParams) {
    const errors = {}

    if (queryParams.page && !isInt(queryParams.page)) {
      errors.page = 'Should be a integer'
    } else if (parseInt(queryParams.page, 10) < 1) {
      errors.page = 'Should be greater than or equal to 1'
    }

    if (queryParams.pageLimit && !isInt(queryParams.pageLimit)) {
      errors.pageLimit = 'Should be a integer'
    } else if (parseInt(queryParams.pageLimit, 10) < 1) {
      errors.pageLimit = 'Should be greater than or equal to 1'
    } else if (parseInt(queryParams.pageLimit, 10) > 12) {
      errors.pageLimit = 'Should be less than or equal to 12'
    }

    const sortOptions = [
      'email',
      '-email',
      'firstName',
      '-firstName',
      'lastName',
      '-lastName',
      'username',
      '-username'
    ]
    if (queryParams.sortBy && !sortOptions.includes(queryParams.sortBy)) {
      errors.sortBy = 'Should be a valid sort'
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
