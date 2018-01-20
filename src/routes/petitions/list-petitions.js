const mongoose = require('mongoose')

const { compact } = require('lodash')
const logger = require('../../helpers/logger')
const { Petition } = require('../../models/petition')
const { Team } = require('../../models/team')
const { Event } = require('../../models/event')

module.exports = async (req, res, next) => {
  const queryParams = req.query
  const userIdObj = mongoose.Types.ObjectId(req.user.id)

  const petitionsQuery = { state: { $in: ['accepted', 'pending', 'rejected'] } }

  if (queryParams.filter === 'sent') {
    petitionsQuery.sender = userIdObj
  } else {
    // get the user's events
    const getUserEvents = req.user.events.map(e => Event.findOne({ _id: e }))
    // get the user's teams
    const getUserTeams = req.user.teams.map(t => Team.findOne({ _id: t }))

    let userEvents = []
    let userTeams = []
    try {
      userEvents = await Promise.all(getUserEvents)
      // remove null values from array
      userEvents = compact(userEvents)
      userTeams = await Promise.all(getUserTeams)
      // remove null values from array
      userTeams = compact(userTeams)
    } catch (err) {
      logger.error('Events/Teams failed to be found at list-petitions')
      return next(err)
    }

    const managedEvents = []
    userEvents.map(e => {
      const eventManagers = e.managers.map(m => m.toString())
      if (eventManagers.includes(req.user.id)) {
        managedEvents.push(mongoose.Types.ObjectId(e.id))
      }
    })

    const managedTeams = []
    userTeams.map(t => {
      const teamManagers = t.managers.map(m => m.toString())
      if (teamManagers.includes(req.user.id)) {
        managedTeams.push(mongoose.Types.ObjectId(t.id))
      }
    })

    petitionsQuery.$or = [
      { user: userIdObj },
      {
        event: {
          $in: managedEvents
        }
      },
      {
        team: {
          $in: managedTeams
        }
      }
    ]
  }

  const sortBy = '-createdAt'

  let page = queryParams.page || 1
  const pageLimit = 12
  if (page > 0) {
    page -= 1
  } else {
    return res
      .status(400)
      .json({ page: 'Should be equal to or greater than 1' })
  }

  // Fetch data
  const aggregateQuery = [
    {
      $match: petitionsQuery
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $lookup: {
        from: 'events',
        let: { event: '$event' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$event']
              }
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              name: 1,
              poster: 1
            }
          }
        ],
        as: 'event'
      }
    },
    {
      $unwind: {
        path: '$event',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'users',
        let: { sender: '$sender' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$sender']
              }
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              avatar: 1,
              firstName: 1,
              lastName: 1
            }
          }
        ],
        as: 'sender'
      }
    },
    {
      $unwind: {
        path: '$sender',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'teams',
        let: { team: '$team' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$team']
              }
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              avatar: 1,
              name: 1
            }
          }
        ],
        as: 'team'
      }
    },
    {
      $unwind: {
        path: '$team',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'users',
        let: { user: '$user' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$user']
              }
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              avatar: 1,
              firstName: 1,
              lastName: 1
            }
          }
        ],
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        createdAt: 1,
        event: 1,
        message: 1,
        sender: 1,
        state: 1,
        team: 1,
        type: 1,
        user: 1
      }
    }
  ]

  // paginate
  aggregateQuery.push(
    {
      $skip: page * pageLimit
    },
    {
      $limit: pageLimit
    }
  )

  let petitions
  let total
  try {
    ;[petitions, total] = await Promise.all([
      Petition.aggregate(aggregateQuery),
      Petition.find(petitionsQuery).count()
    ])
  } catch (err) {
    logger.error('Petitions failed to be found or count at list-petitions')
    return next(err)
  }

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
    results: petitions
  })
}
