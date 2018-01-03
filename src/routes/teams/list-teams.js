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

  let sortBy = '-reviewsAmount'
  if (queryParams.sortBy) {
    const sort = queryParams.sortBy
    const sortOptions = ['name', '-name', 'reviewsAmount', '-reviewsAmount']

    if (sortOptions.includes(sort)) {
      sortBy = sort
    } else {
      return res.status(400).json({ sortBy: 'Invalid type of sort' })
    }
  }

  let page = queryParams.page || 1
  const pageLimit = 12

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
        .sort(sortBy)
        .project({
          avatar: 1,
          description: 1,
          name: 1,
          reviewsAmount: 1
        })
        .skip(page * pageLimit)
        .limit(pageLimit),
      Team.find(teamsQuery).count()
    ])
  } catch (err) {
    logger.error('Teams failed to be found or count at list-teams')
    return next(err)
  }

  const getTeamsRankings = teams.map(t =>
    Team.find({ reviewsAmount: { $gt: t.reviewsAmount } }).count()
  )

  let teamsRankings
  try {
    teamsRankings = await Promise.all(getTeamsRankings)
  } catch (err) {
    logger.error('Teams rankings failed to be count at list-teams')
    return next(err)
  }

  teams = teams.map((t, i) =>
    Object.assign(
      {},
      {
        id: t._id,
        avatar: t.avatar,
        description: t.description,
        name: t.name,
        ranking: teamsRankings[i] + 1,
        reviewsAmount: t.reviewsAmount
      }
    )
  )

  let lastPage = Math.ceil(total / pageLimit)
  if (lastPage > 0) {
    page += 1
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
    page,
    lastPage,
    pageLimit,
    total,
    sortBy,
    results: teams
  })
}
