const Event = require('../../models/event')
const logger = require('../../helpers/logger')
const Petition = require('../../models/petition')
const Team = require('../../models/team')

module.exports = async (req, res, next) => {
  const queryParams = req.query

  let managedEventsIDs = []
  if (req.user.events && req.user.events.length > 0) {
    const eventsPromises = req.user.events.map(e =>
      Event.findOne({ _id: e.toString() })
    )

    let userEvents
    try {
      userEvents = await Promise.all(eventsPromises)
    } catch (err) {
      logger.error('An event failed to be found at list-petitions')
      return next(err)
    }

    const managedEvents = userEvents.filter(e =>
      e.managers.find(m => m.toString() === req.user.id)
    )
    managedEventsIDs = managedEvents.map(e => e.id)
  }

  let managedTeamsIDs = []
  if (req.user.teams && req.user.teams.length > 0) {
    const teamsPromises = req.user.teams.map(t =>
      Team.findOne({ _id: t.toString() })
    )

    let userTeams
    try {
      userTeams = await Promise.all(teamsPromises)
    } catch (err) {
      logger.error('A team failed to be found at list-petitions')
      return next(err)
    }

    const managedTeams = userTeams.filter(t =>
      t.managers.find(m => m.toString() === req.user.id)
    )
    managedTeamsIDs = managedTeams.map(t => t.id)
  }

  const petitionsQuery = {
    $or: [
      { receiverID: req.user.id },
      { receiverID: { $in: managedEventsIDs } },
      { receiverID: { $in: managedTeamsIDs } },
      { senderID: req.user.id },
      { senderID: { $in: managedTeamsIDs } }
    ]
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

  let petitions
  let total
  try {
    ;[petitions, total] = await Promise.all([
      Petition.find(petitionsQuery)
        .select('-__v -updatedAt -createdAt')
        .sort('createdAt')
        .skip(page * pageLimit)
        .limit(pageLimit),
      Petition.find(petitionsQuery).count()
    ])
  } catch (err) {
    logger.error('Petitions failed to be found or count at list-petitions')
    return next(err)
  }

  let first = `${process.env.API_URL}/petitions?page=1`
  const lastPage = Math.ceil(total / pageLimit)
  let last = `${process.env.API_URL}/petitions?page=${lastPage}`
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
    results: petitions,
    total
  })
}
