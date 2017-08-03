const { isEmpty } = require('lodash')
const { isMongoId } = require('validator')

const Petition = require('../../models/petition')

module.exports = {
  validateCreatePetition(data) {
    const errors = {}

    if (!data.entityID) {
      errors.entityID = 'Is required'
    } else if (typeof data.entityID !== 'string') {
      errors.entityID = 'Should be a string'
    } else if (!isMongoId(data.entityID)) {
      errors.entityID = `${data.entityID} should be an ID`
    }

    if (data.receiverID) {
      if (typeof data.receiverID !== 'string') {
        errors.receiverID = 'Should be a string'
      } else if (!isMongoId(data.receiverID)) {
        errors.receiverID = `${data.receiverID} should be an ID`
      }
    }

    if (data.senderID) {
      if (typeof data.senderID !== 'string') {
        errors.senderID = 'Should be a string'
      } else if (!isMongoId(data.senderID)) {
        errors.senderID = `${data.senderID} should be an ID`
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
