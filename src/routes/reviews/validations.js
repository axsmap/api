const { isEmpty } = require('lodash')
const { isInt, isMongoId } = require('validator')

module.exports = {
  validateCreateEditReview(data) {
    const errors = {}

    if (data.bathroomScore) {
      if (typeof data.bathroomScore !== 'string') {
        errors.bathroomScore = 'Should be a string'
      } else if (!isInt(data.bathroomScore, { min: 1, max: 5 })) {
        errors.bathroomScore = 'Should an integer between 1 and 5'
      }
    }

    if (data.entryScore) {
      if (typeof data.entryScore !== 'string') {
        errors.entryScore = 'Should be a string'
      } else if (!isInt(data.entryScore, { min: 1, max: 5 })) {
        errors.entryScore = 'Should an integer between 1 and 5'
      }
    }

    if (data.event) {
      if (typeof data.event !== 'string') {
        errors.event = 'Should be a string'
      } else if (!isMongoId(data.event)) {
        errors.event = 'Should be a valid Id'
      }
    }

    if (data.guideDog) {
      if (typeof data.guideDog !== 'string') {
        errors.guideDog = 'Should be a string'
      } else if (!isInt(data.guideDog, { min: 0, max: 1 })) {
        errors.entryScore = 'Should an integer between 0 and 1'
      }
    }

    if (data.parking) {
      if (typeof data.parking !== 'string') {
        errors.parking = 'Should be a string'
      } else if (!isInt(data.parking, { min: 0, max: 1 })) {
        errors.parking = 'Should an integer between 0 and 1'
      }
    }

    if (data.quiet) {
      if (typeof data.quiet !== 'string') {
        errors.quiet = 'Should be a string'
      } else if (!isInt(data.quiet, { min: 0, max: 1 })) {
        errors.quiet = 'Should an integer between 0 and 1'
      }
    }

    if (data.ramp) {
      if (typeof data.ramp !== 'string') {
        errors.ramp = 'Should be a string'
      } else if (!isInt(data.ramp, { min: 0, max: 1 })) {
        errors.ramp = 'Should an integer between 0 and 1'
      }
    }

    if (data.secondEntry) {
      if (typeof data.secondEntry !== 'string') {
        errors.secondEntry = 'Should be a string'
      } else if (!isInt(data.secondEntry, { min: 0, max: 1 })) {
        errors.secondEntry = 'Should an integer between 0 and 1'
      }
    }

    if (data.spacious) {
      if (typeof data.spacious !== 'string') {
        errors.spacious = 'Should be a string'
      } else if (!isInt(data.spacious, { min: 0, max: 1 })) {
        errors.spacious = 'Should an integer between 0 and 1'
      }
    }

    if (data.steps) {
      if (typeof data.steps !== 'string') {
        errors.steps = 'Should be a string'
      } else if (!isInt(data.steps, { min: 0, max: 3 })) {
        errors.steps = 'Should an integer between 0 and 3'
      }
    }

    if (data.team) {
      if (typeof data.team !== 'string') {
        errors.team = 'Should be a string'
      } else if (!isMongoId(data.team)) {
        errors.team = 'Should be a valid Id'
      }
    }

    if (data.venue) {
      if (typeof data.venue !== 'string') {
        errors.venue = 'Should be a string'
      } else if (!isMongoId(data.venue)) {
        errors.venue = 'Should be a valid Id'
      }
    }

    if (data.wellLit) {
      if (typeof data.wellLit !== 'string') {
        errors.wellLit = 'Should be a string'
      } else if (!isInt(data.wellLit, { min: 0, max: 1 })) {
        errors.wellLit = 'Should an integer between 0 and 1'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateListReviews(queryParams) {
    const errors = {}

    if (queryParams.bathroomScore) {
      const limits = queryParams.bathroomScore.split(',')

      if (limits.length !== 2) {
        errors.bathroomScore = 'Should be two integers split by a comma'
      } else if (
        !isInt(limits[0], { min: 1, max: 5 }) ||
        !isInt(limits[1], { min: 1, max: 5 })
      ) {
        errors.bathroomScore = 'Both should be integers between 1 and 5'
      }
    }

    if (queryParams.entryScore) {
      const limits = queryParams.entryScore.split(',')

      if (limits.length !== 2) {
        errors.bathroomScore = 'Should be two integers split by a comma'
      } else if (
        !isInt(limits[0], { min: 1, max: 5 }) ||
        !isInt(limits[1], { min: 1, max: 5 })
      ) {
        errors.bathroomScore = 'Both should be integers between 1 and 5'
      }
    }

    if (queryParams.event && !isMongoId(queryParams.event)) {
      errors.event = 'Should be a valid Id'
    }

    if (
      queryParams.guideDog &&
      !isInt(queryParams.guideDog, { min: 0, max: 1 })
    ) {
      errors.guideDog = 'Should be an integer between 0 and 1'
    }

    if (
      queryParams.parking &&
      !isInt(queryParams.parking, { min: 0, max: 1 })
    ) {
      errors.parking = 'Should be an integer between 0 and 1'
    }

    if (queryParams.quiet && !isInt(queryParams.quiet, { min: 0, max: 1 })) {
      errors.quiet = 'Should be an integer between 0 and 1'
    }

    if (queryParams.ramp && !isInt(queryParams.ramp, { min: 0, max: 1 })) {
      errors.ramp = 'Should be an integer between 0 and 1'
    }

    if (
      queryParams.secondEntry &&
      !isInt(queryParams.secondEntry, { min: 0, max: 1 })
    ) {
      errors.secondEntry = 'Should be an integer between 0 and 1'
    }

    if (
      queryParams.spacious &&
      !isInt(queryParams.spacious, { min: 0, max: 1 })
    ) {
      errors.spacious = 'Should be an integer between 0 and 1'
    }

    if (queryParams.steps && !isInt(queryParams.steps, { min: 0, max: 3 })) {
      errors.steps = 'Should be an integer between 0 and 3'
    }

    if (queryParams.team && !isMongoId(queryParams.team)) {
      errors.team = 'Should be a valid Id'
    }

    if (queryParams.user && !isMongoId(queryParams.user)) {
      errors.user = 'Should be a valid Id'
    }

    if (queryParams.venue && !isMongoId(queryParams.venue)) {
      errors.venue = 'Should be a valid Id'
    }

    if (
      queryParams.wellLit &&
      !isInt(queryParams.wellLit, { min: 0, max: 1 })
    ) {
      errors.wellLit = 'Should be an integer between 0 and 1'
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
