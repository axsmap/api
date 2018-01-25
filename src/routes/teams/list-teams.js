const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

const { validateListTeams } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query

  const { errors, isValid } = validateListTeams(queryParams)
  if (!isValid) return res.status(400).json(errors)

  const teamsQuery = { isArchived: false }

  if (queryParams.keywords) {
    teamsQuery.$text = { $search: queryParams.keywords }
  }

  let sortBy = queryParams.sortBy || '-reviewsAmount'
  let page = queryParams.page ? queryParams.page - 1 : 1
  const pageLimit = queryParams.pageLimit || 12

  let teams
  let total
  try {
    ;[teams, total] = await Promise.all([
      Team.aggregate()
        .match(teamsQuery)
        .project({
          _id: 0,
          id: '$_id',
          avatar: 1,
          description: 1,
          name: 1,
          reviewsAmount: 1
        })
        .sort(sortBy)
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

  teams = teams.map((t, i) => ({
    id: t.id,
    avatar: t.avatar,
    description: t.description,
    name: t.name,
    ranking: teamsRankings[i] + 1,
    reviewsAmount: t.reviewsAmount
  }))

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
