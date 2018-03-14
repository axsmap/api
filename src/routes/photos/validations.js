const { isEmpty } = require('lodash')

module.exports = {
  validateCreatePhoto(data) {
    const errors = {}

    if (
      typeof data.isWide !== 'undefined' &&
      typeof data.isWide !== 'boolean'
    ) {
      errors.isWide = 'Should be a boolean'
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateEditPhoto(data) {
    const errors = {}

    if (
      typeof data.isWide !== 'undefined' &&
      typeof data.isWide !== 'boolean'
    ) {
      errors.isWide = 'Should be a boolean'
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
