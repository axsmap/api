const { isEmpty } = require('lodash')
const { isMongoId } = require('validator')
const moment = require('moment')

const { isNumber } = require('../../helpers')

module.exports = {
  validateCreateEvent(data) {
    const errors = {}
    let endDateIsValid = false
    let startDateIsValid = false

    if (!data.endDate) {
      errors.endDate = 'Is required'
    } else if (typeof data.endDate !== 'string') {
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

    if (!data.name) {
      errors.name = 'Is required'
    } else if (typeof data.name !== 'string') {
      errors.name = 'Should be a string'
    }

    if (!data.pointCoordinates) {
      errors.pointCoordinates = 'Is required'
    } else if (!Array.isArray(data.pointCoordinates)) {
      errors.pointCoordinates = 'Should be an array of point coordinates'
    } else if (!data.pointCoordinates[0]) {
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

    if (!data.startDate) {
      errors.startDate = 'Is required'
    } else if (typeof data.startDate !== 'string') {
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
        errors.managers = 'Should be an array of users IDs'
      } else if (data.managers.length > 0) {
        data.managers.forEach(m => {
          if (m && m.toString().startsWith('-')) {
            m = m.substring(1)
          }

          if (!m || !isMongoId(m.toString())) {
            errors.managers = `${m} should be an user ID`
          }
        })
      }
    }

    if (data.participants) {
      if (!Array.isArray(data.participants)) {
        errors.participants = 'Should be an array of users IDs'
      } else if (data.participants.length > 0) {
        data.participants.forEach(p => {
          if (!p) {
            errors.participants = `${p} should not be null`
          } else if (!p.toString().startsWith('-')) {
            errors.participants = `${p} should start with -`
          } else if (!isMongoId(p.substring(1))) {
            errors.participants = `${p} should be an user ID`
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
        errors.teams = 'Should be an array of teams IDs'
      } else if (data.teams.length > 0) {
        data.teams.forEach(t => {
          if (!t) {
            errors.teams = `${t} should not be null`
          } else if (!t.toString().startsWith('-')) {
            errors.teams = `${t} should start with -`
          } else if (!isMongoId(t.substring(1))) {
            errors.teams = `${t} should be an user ID`
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
    let isBeforeDateValid = false
    const errors = {}
    let isAfterDateValid = false

    if (
      queryParams.afterDate &&
      !moment(queryParams.afterDate, 'YYYY-MM-DD', true).isValid()
    ) {
      errors.afterDate = 'Should have YYYY-MM-DD format'
    }

    if (
      queryParams.beforeDate &&
      !moment(queryParams.beforeDate, 'YYYY-MM-DD', true).isValid()
    ) {
      errors.beforeDate = 'Should have YYYY-MM-DD format'
    }

    if (queryParams.creator && !isMongoId(queryParams.creator)) {
      errors.creator = `${queryParams.creator} should be an user ID`
    }

    if (queryParams.isApproved) {
      if (!Number.isInteger(queryParams.isApproved)) {
        errors.isApproved = 'Should be an integer'
      } else if (queryParams.isApproved !== 1 && queryParams.isApproved !== 0) {
        errors.isApproved = 'Should be 0 or 1'
      }
    }

    if (queryParams.managers) {
      const managers = [...new Set(queryParams.managers.split(','))]

      if (managers.length === 0) {
        errors.managers = 'Should have at least one user ID'
      } else {
        managers.forEach(m => {
          if (!m || !isMongoId(m)) {
            errors.managers = `${m} should be an user ID`
          }
        })
      }
    }

    if (queryParams.participants) {
      const participants = [...new Set(queryParams.participants.split(','))]

      if (participants.length === 0) {
        errors.participants = 'Should have at least one user ID'
      } else {
        participants.forEach(p => {
          if (!p || !isMongoId(p)) {
            errors.participants = `${p} should be an user ID`
          }
        })
      }
    }

    if (queryParams.teams) {
      const teams = [...new Set(queryParams.teams.split(','))]

      if (teams.length === 0) {
        errors.teams = 'Should have at least one team ID'
      } else {
        teams.forEach(t => {
          if (!t || !isMongoId(t)) {
            errors.teams = `${t} should be a team ID`
          }
        })
      }
    }

    if (isAfterDateValid && isBeforeDateValid) {
      const afterDate = moment(queryParams.afterDate, 'YYYY-MM-DD').utc()
      const beforeDate = moment(queryParams.beforeDate, 'YYYY-MM-DD').utc()
      if (afterDate.isAfter(beforeDate)) {
        errors.afterDate = 'Should be less than beforeDate'
        errors.beforeDate = 'Should be greater than afterDate'
      }
    }

    return { errors, isValid: isEmpty(errors) }
  },
  validateParticipateEvent(data) {
    const errors = {}

    if (data.t && !isMongoId(data.t.toString())) {
      errors.t = `${data.t} should be a team ID`
    }

    return { errors, isValid: isEmpty(errors) }
  }
}
