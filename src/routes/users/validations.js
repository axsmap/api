const freemail = require('freemail')
const { isEmail } = require('validator')
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

    if (data.description) {
      if (typeof data.description !== 'string') {
        errors.description = 'Should be a string'
      } else if (cleanSpaces(data.description).length > 2000) {
        errors.description = 'Should have less than 2001 characters'
      }
    }

    if (data.email) {
      if (typeof data.email !== 'string') {
        errors.email = 'Should be a string'
      } else if (cleanSpaces(data.email).length > 254) {
        errors.email = 'Should have less than 255 characters'
      } else if (!isEmail(data.email) || freemail.isDisposable(data.email)) {
        errors.email = 'Is not a valid email'
      }
    }

    if (data.firstName) {
      if (typeof data.firstName !== 'string') {
        errors.firstName = 'Should be a string'
      } else if (
        /[~`!#$%^&*+=\-[\]\\';,./{}|\\":<>?\d]/g.test(data.firstName)
      ) {
        errors.firstName = 'Should only have letters'
      } else if (cleanSpaces(data.firstName).length > 24) {
        errors.firstName = 'Should have less than 25 characters'
      } else {
        const firstName = cleanSpaces(data.firstName)

        if (firstName.split(' ').length > 1) {
          errors.firstName = 'Should only be one name'
        }
      }
    }

    if (data.lastName) {
      if (typeof data.lastName !== 'string') {
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
  validateListUsers(queryParams) {
    const errors = {}

    if (queryParams.disabilities) {
      const queryDisabilities = queryParams.disabilities.split(',')
      const userDisabilities = User.schema.path('disability').enumValues

      queryDisabilities.forEach(disability => {
        if (!userDisabilities.includes(disability)) {
          errors.disabilities = 'Invalid type of disability'
        }
      })
    }

    if (queryParams.genders) {
      const queryGenders = queryParams.genders.split(',')
      const userGenders = User.schema.path('gender').enumValues

      queryGenders.forEach(gender => {
        if (!userGenders.includes(gender)) {
          errors.genders = 'Invalid type of gender'
        }
      })
    }

    if (queryParams.isAdmin) {
      const isAdmin = queryParams.isAdmin

      if (isAdmin !== '0' && isAdmin !== '1') {
        errors.isAdmin = 'Should be 0 or 1'
      }
    }

    if (queryParams.isBlocked) {
      const isBlocked = queryParams.isBlocked

      if (isBlocked !== '0' && isBlocked !== '1') {
        errors.isBlocked = 'Should be 0 or 1'
      }
    }

    if (queryParams.isSubscribed) {
      const isSubscribed = queryParams.isSubscribed

      if (isSubscribed !== '0' && isSubscribed !== '1') {
        errors.isSubscribed = 'Should be 0 or 1'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
