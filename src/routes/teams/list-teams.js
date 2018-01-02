const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

const { validateListTeams } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query
  const { errors, isValid } = validateListTeams(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const teamsQuery = { isArchived: false }

  if (queryParams.keywords) {
    teamsQuery.$text = { $search: queryParams.keywords }
  }

  if (queryParams.managers) {
    const managers = [...new Set(queryParams.managers.toString().split(','))]
    teamsQuery.managers = { $in: managers }
  }

  if (queryParams.members) {
    const members = [...new Set(queryParams.members.toString().split(','))]
    teamsQuery.members = { $in: members }
  }

  let sortField = '-reviewsAmount'
  if (queryParams.sortBy) {
    const sort = queryParams.sortBy
    const sortOptions = ['name', '-name', 'reviewsAmount', '-reviewsAmount']

    if (sortOptions.includes(sort)) {
      sortField = sort
    } else {
      return res.status(400).json({ sortBy: 'Invalid type of sort' })
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

  let teams
  let total
  try {
    ;[teams, total] = await Promise.all([
      Team.aggregate()
        .match(teamsQuery)
        .sort(sortField)
        .skip(page * pageLimit)
        .limit(pageLimit),
      Team.find(teamsQuery).count()
    ])
  } catch (err) {
    logger.error('Teams failed to be found or count at list-teams')
    return next(err)
  }

  let first = `${process.env.API_URL}/teams?page=1`
  const lastPage = Math.ceil(total / pageLimit)
  let last = `${process.env.API_URL}/teams?page=${lastPage}`
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
    results: teams,
    total: total
  })
}
