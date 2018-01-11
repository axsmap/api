const { isEmpty } = require('lodash')
const { isMongoId } = require('validator')

const { Petition } = require('../../models/petition')

module.exports = {
  validateCreatePetition(data) {
    const errors = {}

    if (data.event) {
      if (typeof data.event !== 'string') {
        errors.event = 'Should be a string'
      } else if (!isMongoId(data.event)) {
        errors.event = 'Should be a valid id'
      }
    }

    if (data.message && typeof data.message !== 'string') {
      errors.message = 'Should be a string'
    }

    if (data.team) {
      if (typeof data.team !== 'string') {
        errors.team = 'Should be a string'
      } else if (!isMongoId(data.team)) {
        errors.team = 'Should be a valid id'
      }
    }

    const petitionTypes = Petition.schema.path('type').enumValues
    if (!data.type) {
      errors.type = 'Is required'
    } else if (typeof data.type !== 'string') {
      errors.type = 'Should be a string'
    } else if (!petitionTypes.includes(data.type)) {
      errors.type = 'Should be a valid type'
    } else if (
      data.type === 'invite-team-event' ||
      data.type === 'request-team-event'
    ) {
      if (!data.event) errors.event = 'Is required'
      if (!data.team) errors.team = 'Is required'
    } else if (data.type === 'invite-user-event') {
      if (!data.event) errors.event = 'Is required'
      if (!data.user) errors.user = 'Is required'
    } else if (data.type === 'request-user-event' && !data.event) {
      errors.event = 'Is required'
    } else if (data.type === 'invite-user-team') {
      if (!data.team) errors.team = 'Is required'
      if (!data.user) errors.user = 'Is required'
    } else if (data.type === 'request-user-team' && !data.team) {
      errors.team = 'Is required'
    }

    if (data.user) {
      if (typeof data.user !== 'string') {
        errors.user = 'Should be a string'
      } else if (!isMongoId(data.user)) {
        errors.user = 'Should be a valid id'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
