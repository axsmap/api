const { isEmpty } = require('lodash')
const { isBase64, isInt, isMongoId } = require('validator')
const moment = require('moment')

const { isNumber } = require('../../helpers')

module.exports = {
  validateCreateEvent(data) {
    const errors = {}

    if (
      typeof data.address === 'undefined' ||
      data.address === '' ||
      data.address === null
    ) {
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

    let endDateIsValid = false
    if (
      typeof data.endDate === 'undefined' ||
      data.endDate === '' ||
      data.endDate === null
    ) {
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

    if (!data.locationCoordinates) {
      errors.locationCoordinates = 'Is required'
    } else if (!Array.isArray(data.locationCoordinates)) {
      errors.locationCoordinates = 'Should be an array'
    } else if (!data.locationCoordinates[0]) {
      errors.locationCoordinates = 'Latitude is required'
    } else if (!isNumber(data.locationCoordinates[0])) {
      errors.locationCoordinates = 'Latitude should be a number'
    } else if (
      parseFloat(data.locationCoordinates[0]) < -90 ||
      parseFloat(data.locationCoordinates[0]) > 90
    ) {
      errors.locationCoordinates = 'Latitude value is not valid'
    } else if (!data.locationCoordinates[1]) {
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

    if (
      typeof data.name === 'undefined' ||
      data.name === '' ||
      data.name === null
    ) {
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

    if (data.poster) {
      if (typeof data.poster !== 'string') {
        errors.poster = 'Should be a string'
      } else {
        const posterBase64 = data.poster.split(',')[1]
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
    if (
      typeof data.startDate === 'undefined' ||
      data.startDate === '' ||
      data.startDate === null
    ) {
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

    if (data.teamManager) {
      if (typeof data.teamManager !== 'string') {
        errors.teamManager = 'Should be a string'
      } else if (!isMongoId(data.teamManager)) {
        errors.teamManager = 'Should be a valid id'
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
  validateEditEvent(data) {
    const errors = {}
    let endDateIsValid = false
    let startDateIsValid = false

    if (data.endDate) {
      if (typeof data.endDate !== 'string') {
        errors.endDate = 'Should be a string'
      } else if (!moment(data.endDate, 'YYYY-MM-DD', true).isValid()) {
        errors.endDate = 'Should have YYYY-MM-DD format'
      } else {
        const endDate = moment(data.endDate, 'YYYY-MM-DD').utc()
        const today = moment().utc()

        if (endDate.isBefore(today)) {
          errors.endDate = 'Should be greater than or equal to today'
        } else {
          endDateIsValid = true
        }
      }
    }

    if (data.managers) {
      if (!Array.isArray(data.managers)) {
        errors.managers = 'Should be an array of users Ids'
      } else if (data.managers.length > 0) {
        data.managers.forEach(m => {
          if (m && m.toString().startsWith('-')) {
            m = m.substring(1)
          }

          if (!m || !isMongoId(m.toString())) {
            errors.managers = `${m} should be an user Id`
          }
        })
      }
    }

    if (data.participants) {
      if (!Array.isArray(data.participants)) {
        errors.participants = 'Should be an array of users Ids'
      } else if (data.participants.length > 0) {
        data.participants.forEach(p => {
          if (!p) {
            errors.participants = `${p} should not be null`
          } else if (!p.toString().startsWith('-')) {
            errors.participants = `${p} should start with -`
          } else if (!isMongoId(p.substring(1))) {
            errors.participants = `${p} should be an user Id`
          }
        })
      }
    }

    if (data.pointCoordinates) {
      if (!Array.isArray(data.pointCoordinates)) {
        errors.pointCoordinates = 'Should be an array of point coordinates'
      } else if (data.pointCoordinates.length > 0) {
        if (!data.pointCoordinates[0]) {
          errors.pointCoordinates = 'Latitude is required'
        } else if (!isNumber(data.pointCoordinates[0])) {
          errors.pointCoordinates = 'Latitude should be a number'
        } else if (
          parseFloat(data.pointCoordinates[0]) < -90 ||
          parseFloat(data.pointCoordinates[0]) > 90
        ) {
          errors.pointCoordinates = 'Latitude value is not valid'
        } else if (!data.pointCoordinates[1]) {
          errors.pointCoordinates = 'Longitude is required'
        } else if (!isNumber(data.pointCoordinates[1])) {
          errors.pointCoordinates = 'Longitude should be a number'
        } else if (
          parseFloat(data.pointCoordinates[1]) < -180 ||
          parseFloat(data.pointCoordinates[1]) > 180
        ) {
          errors.pointCoordinates = 'Longitude value is not valid'
        } else if (data.pointCoordinates.length > 2) {
          errors.pointCoordinates = 'Should only have latitude and longitude'
        }
      }
    }

    if (data.startDate) {
      if (typeof data.startDate !== 'string') {
        errors.startDate = 'Should be a string'
      } else if (!moment(data.startDate, 'YYYY-MM-DD', true).isValid()) {
        errors.startDate = 'Should have YYYY-MM-DD format'
      } else {
        const startDate = moment(data.startDate, 'YYYY-MM-DD').utc()
        const today = moment().utc()

        if (startDate.isBefore(today)) {
          errors.startDate = 'Should be greater than or equal to today'
        } else {
          startDateIsValid = true
        }
      }
    }

    if (data.teams) {
      if (!Array.isArray(data.teams)) {
        errors.teams = 'Should be an array of teams Ids'
      } else if (data.teams.length > 0) {
        data.teams.forEach(t => {
          if (!t) {
            errors.teams = `${t} should not be null`
          } else if (!t.toString().startsWith('-')) {
            errors.teams = `${t} should start with -`
          } else if (!isMongoId(t.substring(1))) {
            errors.teams = `${t} should be an user Id`
          }
        })
      }
    }

    if (endDateIsValid && startDateIsValid) {
      const endDate = moment(data.endDate, 'YYYY-MM-DD').utc()
      const startDate = moment(data.startDate, 'YYYY-MM-DD').utc()

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
