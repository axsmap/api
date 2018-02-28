const { isEmpty } = require('lodash')
const { isBase64, isInt, isMongoId } = require('validator')
const moment = require('moment')

const { isNumber } = require('../../helpers')

module.exports = {
  validateCreateEvent(data) {
    const errors = {}

    if (typeof data.address === 'undefined' || data.address === '') {
      errors.address = 'Is required'
    } else if (typeof data.address !== 'string') {
      errors.address = 'Should be a string'
    }

    if (
      typeof data.description !== 'undefined' &&
      typeof data.description !== 'string'
    ) {
      errors.description = 'Should be a string'
    }

    if (data.donationEnabled === true) {
      if (typeof data.donationAmounts === 'undefined') {
        errors.donationAmounts = 'Is required'
      }
      if (typeof data.donationGoal === 'undefined') {
        errors.donationGoal = 'Is required'
      }
    }

    if (typeof data.donationAmounts !== 'undefined') {
      if (!Array.isArray(data.donationAmounts)) {
        errors.donationAmounts = 'Should be an array'
      } else {
        data.donationAmounts.some(d => {
          if (typeof d.value === 'undefined') {
            errors.donationAmounts = 'All elements should have a value property'
            return true
          } else if (typeof d.value !== 'number') {
            errors.donationAmounts = 'All value properties should be numbers'
            return true
          } else if (d < 5 || d > 10000) {
            errors.donationAmounts =
              'All value properties should be between 5 and 10000'
            return true
          } else if (typeof d.description !== 'undefined') {
            if (typeof d.description !== 'string') {
              errors.donationAmounts =
                'All description properties should be strings'
              return true
            } else if (d.description.length > 100) {
              errors.donationAmounts =
                'All description properties should be less than 101 characters'
              return true
            }
          }
        })
      }
    }

    if (
      typeof data.donationEnabled !== 'undefined' &&
      typeof data.donationEnabled !== 'boolean'
    ) {
      errors.donationEnabled = 'Should be a boolean'
    }

    if (typeof data.donationGoal !== 'undefined') {
      if (typeof data.donationGoal !== 'number') {
        errors.donationGoal = 'Should be a number'
      } else if (!isInt(data.donationGoal.toString())) {
        errors.donationGoal = 'Should be a integer'
      }
    }

    let endDateIsValid = false
    if (typeof data.endDate === 'undefined' || data.endDate === '') {
      errors.endDate = 'Is required'
    } else if (typeof data.endDate !== 'string') {
      errors.endDate = 'Should be a string'
    } else if (!moment(data.endDate).isValid()) {
      errors.endDate = 'Should have a ISO-8601 format'
    } else {
      const endDate = moment(data.endDate).utc()
      const today = moment().utc()

      if (endDate.isBefore(today)) {
        errors.endDate = 'Should be greater than or equal to today'
      } else {
        endDateIsValid = true
      }
    }

    if (
      typeof data.isOpen !== 'undefined' &&
      typeof data.isOpen !== 'boolean'
    ) {
      errors.isOpen = 'Should be a boolean'
    }

    if (typeof data.locationCoordinates === 'undefined') {
      errors.locationCoordinates = 'Is required'
    } else if (!Array.isArray(data.locationCoordinates)) {
      errors.locationCoordinates = 'Should be an array'
    } else if (typeof data.locationCoordinates[0] === 'undefined') {
      errors.locationCoordinates = 'Latitude is required'
    } else if (!isNumber(data.locationCoordinates[0])) {
      errors.locationCoordinates = 'Latitude should be a number'
    } else if (
      parseFloat(data.locationCoordinates[0]) < -90 ||
      parseFloat(data.locationCoordinates[0]) > 90
    ) {
      errors.locationCoordinates = 'Latitude value is not valid'
    } else if (typeof data.locationCoordinates[1] === 'undefined') {
      errors.locationCoordinates = 'Longitude is required'
    } else if (!isNumber(data.locationCoordinates[1])) {
      errors.locationCoordinates = 'Longitude should be a number'
    } else if (
      parseFloat(data.locationCoordinates[1]) < -180 ||
      parseFloat(data.locationCoordinates[1]) > 180
    ) {
      errors.locationCoordinates = 'Longitude value is not valid'
    } else if (data.locationCoordinates.length > 2) {
      errors.locationCoordinates = 'Should only have latitude and longitude'
    }

    if (typeof data.name === 'undefined' || data.name === '') {
      errors.name = 'Is required'
    } else if (typeof data.name !== 'string') {
      errors.name = 'Should be a string'
    }

    if (typeof data.participantsGoal === 'undefined') {
      errors.participantsGoal = 'Is required'
    } else if (typeof data.participantsGoal !== 'number') {
      errors.participantsGoal = 'Should be a number'
    } else if (!isInt(data.participantsGoal.toString())) {
      errors.participantsGoal = 'Should be a integer'
    }

    if (typeof data.poster !== 'undefined') {
      if (typeof data.poster !== 'string') {
        errors.poster = 'Should be a string'
      } else {
        const posterBase64 = data.poster.split(',')[1] || ''
        if (!isBase64(posterBase64)) {
          errors.poster = 'Should be a valid base 64 string'
        } else if (posterBase64.length > 8388608) {
          errors.poster = 'Should be less than 8MB'
        }
      }
    }

    if (typeof data.reviewsGoal === 'undefined') {
      errors.reviewsGoal = 'Is required'
    } else if (typeof data.reviewsGoal !== 'number') {
      errors.reviewsGoal = 'Should be a number'
    } else if (!isInt(data.reviewsGoal.toString())) {
      errors.reviewsGoal = 'Should be a integer'
    }

    let startDateIsValid = false
    if (typeof data.startDate === 'undefined' || data.startDate === '') {
      errors.startDate = 'Is required'
    } else if (typeof data.startDate !== 'string') {
      errors.startDate = 'Should be a string'
    } else if (!moment(data.startDate).isValid()) {
      errors.startDate = 'Should have a ISO-8601 format'
    } else {
      const startDate = moment(data.startDate).utc()
      const today = moment().utc()

      if (startDate.isBefore(today)) {
        errors.startDate = 'Should be greater than or equal to today'
      } else {
        startDateIsValid = true
      }
    }

    if (
      typeof data.teamManager !== 'undefined' &&
      typeof data.teamManager !== 'string'
    ) {
      errors.teamManager = 'Should be a string'
    } else if (data.teamManager && !isMongoId(data.teamManager)) {
      errors.teamManager = 'Should be a valid id'
    }

    if (endDateIsValid && startDateIsValid) {
      const endDate = moment(data.endDate).utc()
      const startDate = moment(data.startDate).utc()

      if (startDate.isAfter(endDate)) {
        errors.endDate = 'Should be greater than or equal to startDate'
        errors.startDate = 'Should be less than or equal to endDate'
      } else if (endDate.diff(startDate, 'days') > 365) {
        errors.endDate = 'Should last less than 365 days'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateEditEvent(data) {
    const errors = {}

    if (typeof data.address !== 'undefined') {
      if (typeof data.address !== 'string') {
        errors.address = 'Should be a string'
      } else if (data.address === '') {
        errors.address = 'Is required'
      }
    }

    if (
      typeof data.description !== 'undefined' &&
      typeof data.description !== 'string'
    ) {
      errors.description = 'Should be a string'
    }

    let endDateIsValid = false
    if (typeof data.endDate !== 'undefined') {
      if (typeof data.endDate !== 'string') {
        errors.endDate = 'Should be a string'
      } else if (data.endDate === '') {
        errors.endDate = 'Is required'
      } else if (!moment(data.endDate).isValid()) {
        errors.endDate = 'Should have a ISO-8601 format'
      } else {
        const endDate = moment(data.endDate).utc()
        const today = moment().utc()

        if (endDate.isBefore(today)) {
          errors.endDate = 'Should be greater than or equal to today'
        } else {
          endDateIsValid = true
        }
      }
    }

    if (
      typeof data.isOpen !== 'undefined' &&
      typeof data.isOpen !== 'boolean'
    ) {
      errors.isOpen = 'Should be a boolean'
    }

    if (typeof data.locationCoordinates !== 'undefined') {
      if (!Array.isArray(data.locationCoordinates)) {
        errors.locationCoordinates = 'Should be an array'
      } else if (typeof data.locationCoordinates[0] === 'undefined') {
        errors.locationCoordinates = 'Latitude is required'
      } else if (!isNumber(data.locationCoordinates[0])) {
        errors.locationCoordinates = 'Latitude should be a number'
      } else if (
        parseFloat(data.locationCoordinates[0]) < -90 ||
        parseFloat(data.locationCoordinates[0]) > 90
      ) {
        errors.locationCoordinates = 'Latitude value is not valid'
      } else if (typeof data.locationCoordinates[1] === 'undefined') {
        errors.locationCoordinates = 'Longitude is required'
      } else if (!isNumber(data.locationCoordinates[1])) {
        errors.locationCoordinates = 'Longitude should be a number'
      } else if (
        parseFloat(data.locationCoordinates[1]) < -180 ||
        parseFloat(data.locationCoordinates[1]) > 180
      ) {
        errors.locationCoordinates = 'Longitude value is not valid'
      } else if (data.locationCoordinates.length > 2) {
        errors.locationCoordinates = 'Should only have latitude and longitude'
      }
    }

    if (typeof data.managers !== 'undefined') {
      if (!Array.isArray(data.managers)) {
        errors.managers = 'Should be an array'
      } else {
        data.managers.some(m => {
          if (typeof m !== 'string') {
            errors.managers = 'Should only have string values'
            return true
          } else if (!m) {
            errors.managers = 'Should not have empty values'
            return true
          } else {
            if (m.startsWith('-')) {
              m = m.substring(1)
            }

            if (!isMongoId(m)) {
              errors.managers = `${m} should be an id`
              return true
            }
          }
        })
      }
    }

    if (typeof data.name !== 'undefined') {
      if (typeof data.name !== 'string') {
        errors.name = 'Should be a string'
      } else if (data.address === '') {
        errors.name = 'Is required'
      }
    }

    if (typeof data.participants !== 'undefined') {
      if (!Array.isArray(data.participants)) {
        errors.participants = 'Should be an array'
      } else {
        data.participants.some(p => {
          if (typeof p !== 'string') {
            errors.participants = 'Should only have string values'
            return true
          } else if (!p) {
            errors.participants = 'Should not have empty values'
            return true
          } else if (!p.startsWith('-')) {
            errors.participants = `${p} should start with -`
            return true
          } else if (!isMongoId(p.substring(1))) {
            errors.participants = `${p} should be an id`
            return true
          }
        })
      }
    }

    if (typeof data.participantsGoal !== 'undefined') {
      if (data.participantsGoal === null) {
        errors.participantsGoal = 'Is required'
      } else if (typeof data.participantsGoal !== 'number') {
        errors.participantsGoal = 'Should be a number'
      } else if (!isInt(data.participantsGoal.toString())) {
        errors.participantsGoal = 'Should be a integer'
      }
    }

    if (typeof data.poster !== 'undefined') {
      if (typeof data.poster !== 'string') {
        errors.poster = 'Should be a string'
      } else if (data.poster) {
        const posterBase64 = data.poster.split(',')[1] || ''
        if (!isBase64(posterBase64)) {
          errors.poster = 'Should be a valid base 64 string'
        } else if (posterBase64.length > 8388608) {
          errors.poster = 'Should be less than 8MB'
        }
      }
    }

    if (typeof data.reviewsGoal !== 'undefined') {
      if (data.reviewsGoal === null) {
        errors.reviewsGoal = 'Is required'
      } else if (typeof data.reviewsGoal !== 'number') {
        errors.reviewsGoal = 'Should be a number'
      } else if (!isInt(data.reviewsGoal.toString())) {
        errors.reviewsGoal = 'Should be a integer'
      }
    }

    let startDateIsValid = false
    if (typeof data.startDate !== 'undefined') {
      if (typeof data.startDate !== 'string') {
        errors.startDate = 'Should be a string'
      } else if (data.startDate === '') {
        errors.startDate = 'Is required'
      } else if (!moment(data.startDate).isValid()) {
        errors.startDate = 'Should have a ISO-8601 format'
      } else {
        const startDate = moment(data.startDate).utc()
        const today = moment().utc()

        if (startDate.isBefore(today)) {
          errors.startDate = 'Should be greater than or equal to today'
        } else {
          startDateIsValid = true
        }
      }
    }

    if (
      typeof data.teamManager !== 'undefined' &&
      typeof data.teamManager !== 'string'
    ) {
      errors.teamManager = 'Should be a string'
    } else if (data.teamManager && !isMongoId(data.teamManager)) {
      errors.teamManager = 'Should be a valid id'
    }

    if (typeof data.teams !== 'undefined') {
      if (!Array.isArray(data.teams)) {
        errors.teams = 'Should be an array'
      } else {
        data.teams.some(t => {
          if (typeof t !== 'string') {
            errors.teams = 'Should only have string values'
            return true
          } else if (!t) {
            errors.teams = 'Should not have empty values'
            return true
          } else if (!t.startsWith('-')) {
            errors.teams = `${t} should start with -`
            return true
          } else if (!isMongoId(t.substring(1))) {
            errors.teams = `${t} should be an id`
            return true
          }
        })
      }
    }

    if (endDateIsValid && startDateIsValid) {
      const endDate = moment(data.endDate).utc()
      const startDate = moment(data.startDate).utc()

      if (startDate.isAfter(endDate)) {
        errors.endDate = 'Should be greater than or equal to startDate'
        errors.startDate = 'Should be less than or equal to endDate'
      } else if (endDate.diff(startDate, 'days') > 365) {
        errors.endDate = 'Should last less than 365 days'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateListEvents(queryParams) {
    const errors = {}

    let isAfterDateValid = false
    if (
      queryParams.afterDate &&
      !moment(queryParams.afterDate, 'YYYY-MM-DD', true).isValid()
    ) {
      errors.afterDate = 'Should have YYYY-MM-DD format'
    } else {
      isAfterDateValid = true
    }

    let isBeforeDateValid = false
    if (
      queryParams.beforeDate &&
      !moment(queryParams.beforeDate, 'YYYY-MM-DD', true).isValid()
    ) {
      errors.beforeDate = 'Should have YYYY-MM-DD format'
    } else {
      isBeforeDateValid = true
    }

    if (isAfterDateValid && isBeforeDateValid) {
      const afterDate = moment(queryParams.afterDate, 'YYYY-MM-DD').utc()
      const beforeDate = moment(queryParams.beforeDate, 'YYYY-MM-DD').utc()
      if (afterDate.isAfter(beforeDate)) {
        errors.afterDate = 'Should be less than beforeDate'
        errors.beforeDate = 'Should be greater than afterDate'
      }
    }

    const sortOptions = [
      'name',
      '-name',
      'reviewsAmount',
      '-reviewsAmount',
      'startDate',
      '-startDate'
    ]
    if (queryParams.sortBy && !sortOptions.includes(queryParams.sortBy)) {
      errors.sortBy = 'Should be a valid sort'
    }

    if (queryParams.page) {
      if (!isInt(queryParams.page)) {
        errors.page = 'Should be a integer'
      } else if (parseInt(queryParams.page, 10) < 1) {
        errors.page = 'Should be a positive integer'
      }
    }

    if (queryParams.pageLimit) {
      if (!isInt(queryParams.pageLimit)) {
        errors.pageLimit = 'Should be a integer'
      } else if (parseInt(queryParams.pageLimit, 10) < 1) {
        errors.pageLimit = 'Should be a positive integer'
      } else if (parseInt(queryParams.pageLimit, 10) > 12) {
        errors.pageLimit = 'Should be less than 13'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateParticipateEvent(data) {
    const errors = {}

    if (data.t && !isMongoId(data.t.toString())) {
      errors.t = `${data.t} should be a team Id`
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
