const moment = require('moment')
const { toBoolean } = require('validator')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

const { validateListEvents } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const queryParams = req.query
  const { errors, isValid } = validateListEvents(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const eventQuery = {}

  if (queryParams.keywords) {
    eventQuery.$text = { $search: queryParams.keywords }
  }

  let afterDate
  let beforeDate
  if (queryParams.afterDate && queryParams.beforeDate) {
    afterDate = moment(queryParams.afterDate).utc().toDate()
    beforeDate = moment(queryParams.beforeDate).utc().toDate()

    eventQuery.startDate = { $gte: afterDate, $lte: beforeDate }
  } else if (queryParams.afterDate) {
    afterDate = moment(queryParams.afterDate).utc().toDate()
    eventQuery.startDate = { $gte: afterDate }
  } else if (queryParams.beforeDate) {
    beforeDate = moment(queryParams.beforeDate).utc().toDate()
    eventQuery.startDate = { $lte: beforeDate }
  }

  if (queryParams.creator) {
    eventQuery.creator = queryParams.creator
  }

  if (queryParams.isApproved) {
    eventQuery.isApproved = { $eq: toBoolean(queryParams.isApproved) }
  }

  if (queryParams.managers) {
    const managers = [...new Set(queryParams.managers.split(','))]
    eventQuery.managers = { $in: managers }
  }

  if (queryParams.participants) {
    const participants = [...new Set(queryParams.participants.split(','))]
    eventQuery.participants = { $in: participants }
  }

  if (queryParams.teams) {
    const teams = [...new Set(queryParams.teams.split(','))]
    eventQuery.teams = { $in: teams }
  }

  let sortField = 'name'
  if (queryParams.sortBy) {
    const sort = queryParams.sortBy
    const sortOptions = ['name', '-name']

    if (sortOptions.includes(sort)) {
      sortField = sort
    } else {
      return res.status(400).json({ sortBy: 'Should be name or -name' })
    }
  }

  let page = queryParams.page || 1
  const pageLimit = 18

  if (page > 0) {
    page -= 1
  } else {
    return res
      .status(400)
      .json({ page: 'Should be equal to or greater than 1' })
  }

  let events
  let total
  try {
    ;[events, total] = await Promise.all([
      Event.find(eventQuery)
        .select('-__v -updatedAt -createdAt')
        .sort(sortField)
        .skip(page * pageLimit)
        .limit(pageLimit),
      Event.find(eventQuery).count()
    ])
  } catch (err) {
    logger.error('Events failed to be found or count at list-events')
    return next(err)
  }

  let first = `${process.env.API_URL}/events?page=1`
  const lastPage = Math.ceil(total / pageLimit)
  let last = `${process.env.API_URL}/events?page=${lastPage}`
  if (lastPage > 0) {
    page += 1
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be equal to or less than ${lastPage}` })
    }
  } else {
    first = null
    last = null
    page = null
  }

  return res.status(200).json({
    first,
    last,
    page,
    pageLimit,
    results: events,
    total
  })
}
