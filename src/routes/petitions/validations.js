const { isEmpty } = require('lodash')
const { isMongoId } = require('validator')

const Petition = require('../../models/petition')

module.exports = {
  validateCreatePetition(data) {
    const errors = {}

    if (!data.entityId) {
      errors.entityId = 'Is required'
    } else if (typeof data.entityId !== 'string') {
      errors.entityId = 'Should be a string'
    } else if (!isMongoId(data.entityId)) {
      errors.entityId = `${data.entityId} should be an Id`
    }

    if (data.receiverId) {
      if (typeof data.receiverId !== 'string') {
        errors.receiverId = 'Should be a string'
      } else if (!isMongoId(data.receiverId)) {
        errors.receiverId = `${data.receiverId} should be an Id`
      }
    }

    if (data.senderId) {
      if (typeof data.senderId !== 'string') {
        errors.senderId = 'Should be a string'
      } else if (!isMongoId(data.senderId)) {
        errors.senderId = `${data.senderId} should be an Id`
      }
    }

    const petitionTypes = Petition.schema.path('type').enumValues
    if (!data.type) {
      errors.type = 'Is required'
    } else if (typeof data.type !== 'string') {
      errors.type = 'Should be a string'
    } else if (!petitionTypes.includes(data.type)) {
      errors.type = 'Invalid type of petition'
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
