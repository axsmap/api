const { isEmpty } = require('lodash')

const { isNumber } = require('../../helpers')
const { placesTypes } = require('../../helpers/constants')

module.exports = {
  validateListVenues(queryParams) {
    const errors = {}

    if (!queryParams.page) {
      if (!queryParams.location) {
        errors.location = 'Is required'
      } else {
        const location = queryParams.location.split(',')

        if (location.length !== 2) {
          errors.location = 'Should have two coordinates'
        } else if (!location[0]) {
          errors.location = 'Latitude is required'
        } else if (!isNumber(location[0])) {
          errors.location = 'Latitude should be a number'
        } else if (
          parseFloat(location[0]) < -90 ||
          parseFloat(location[0]) > 90
        ) {
          errors.location = 'Latitude value out of bounds'
        } else if (!location[1]) {
          errors.location = 'Longitude is required'
        } else if (!isNumber(location[1])) {
          errors.location = 'Longitude should be a number'
        } else if (
          parseFloat(location[1]) < -180 ||
          parseFloat(location[1]) > 180
        ) {
          errors.location = 'Longitude value out of bounds'
        }
      }

      if (!queryParams.radius) {
        errors.radius = 'Is required'
      } else if (!isNumber(queryParams.radius)) {
        errors.radius = 'Should be a number'
      } else if (parseFloat(queryParams.radius) < 0) {
        errors.radius = 'Should be a positive number'
      } else if (parseFloat(queryParams.radius) > 50000) {
        errors.radius = 'Should be less than 50000'
      }

      if (queryParams.type && !placesTypes.includes(queryParams.type)) {
        errors.type = 'Should be a valid type'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
