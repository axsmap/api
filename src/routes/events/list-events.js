const moment = require('moment')

const { Event } = require('../../models/event')
const logger = require('../../helpers/logger')

const { validateListEvents } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query

  const { errors, isValid } = validateListEvents(queryParams)
  if (!isValid) return res.status(400).json(errors)

  const eventsQuery = {}

  if (queryParams.keywords) {
    eventsQuery.$text = { $search: queryParams.keywords }
  }

  eventsQuery.isArchived = false

  let afterDate
  let beforeDate
  if (queryParams.afterDate && queryParams.beforeDate) {
    afterDate = moment(queryParams.afterDate).utc().toDate()
    beforeDate = moment(queryParams.beforeDate).utc().toDate()

    eventsQuery.startDate = { $gte: afterDate, $lte: beforeDate }
  } else if (queryParams.afterDate) {
    afterDate = moment(queryParams.afterDate).utc().toDate()
    eventsQuery.startDate = { $gte: afterDate }
  } else if (queryParams.beforeDate) {
    beforeDate = moment(queryParams.beforeDate).utc().toDate()
    eventsQuery.startDate = { $lte: beforeDate }
  }

  let sortBy = queryParams.sortBy || '-startDate'
  let page = queryParams.page ? queryParams.page - 1 : 0
  const pageLimit = queryParams.pageLimit || 12

  let events
  let total
  try {
    ;[events, total] = await Promise.all([
      Event.aggregate()
        .match(eventsQuery)
        .project({
          _id: 0,
          id: '$_id',
          address: 1,
          endDate: 1,
          name: 1,
          participants: 1,
          poster: 1,
          reviewsAmount: 1,
          reviewsGoal: 1,
          startDate: 1,
          teams: 1
        })
        .sort(sortBy)
        .skip(page * pageLimit)
        .limit(pageLimit),
      Event.find(eventsQuery).count()
    ])
  } catch (err) {
    logger.error('Events failed to be found or count at list-events')
    return next(err)
  }

  let lastPage = Math.ceil(total / pageLimit)
  if (lastPage > 0) {
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be equal to or less than ${lastPage}` })
    }
  } else {
    page = null
    lastPage = null
  }

  return res.status(200).json({
    page: page + 1,
    lastPage,
    pageLimit,
    total,
    sortBy,
    results: events
  })
}
