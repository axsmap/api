const { isEmpty } = require('lodash')

const { isNumber } = require('../../helpers')
const { languages, placesTypes } = require('../../helpers/constants')

module.exports = {
  validateListVenues(queryParams) {
    const errors = {}

    if (!queryParams.page) {
      if (queryParams.language && !languages.includes(queryParams.language)) {
        errors.language = 'Should be a valid language'
      }

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

      if (queryParams.type && !placesTypes.includes(queryParams.type)) {
        errors.type = 'Should be a valid type'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
