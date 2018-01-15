const mongoose = require('mongoose')

const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

module.exports = async (req, res, next) => {
  const teamId = req.params.teamId

  const teamIdObj = mongoose.Types.ObjectId(teamId)
  let team
  try {
    team = await Team.aggregate([
      {
        $match: { _id: teamIdObj }
      },
      {
        $lookup: {
          from: 'users',
          let: { members: '$members' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$members']
                }
              }
            },
            {
              $project: {
                _id: 0,
                id: '$_id',
                avatar: 1,
                firstName: 1,
                lastName: 1,
                username: 1
              }
            }
          ],
          as: 'members'
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { managers: '$managers' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$managers']
                }
              }
            },
            {
              $project: {
                _id: 0,
                id: '$_id',
                avatar: 1,
                firstName: 1,
                lastName: 1,
                username: 1
              }
            }
          ],
          as: 'managers'
        }
      },
      {
        $lookup: {
          from: 'events',
          let: { events: '$events' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$events']
                }
              }
            },
            {
              $project: {
                _id: 0,
                id: '$_id',
                endDate: 1,
                name: 1,
                poster: 1,
                startDate: 1
              }
            }
          ],
          as: 'events'
        }
      },
      {
        $lookup: {
          from: 'teams',
          let: { reviewsAmount: '$reviewsAmount' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $gt: ['$reviewsAmount', '$$reviewsAmount']
                }
              }
            },
            {
              $count: 'ranking'
            }
          ],
          as: 'ranking'
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          avatar: 1,
          description: 1,
          reviewsAmount: 1,
          name: 1,
          members: 1,
          events: 1,
          managers: 1,
          ranking: 1
        }
      }
    ])
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at get-team`)
    return next(err)
  }

  if (team) {
    const dataResponse = Object.assign({}, team[0], {
      ranking: team[0].ranking.length ? team[0].ranking[0].ranking + 1 : 1
    })
    return res.status(200).json(dataResponse)
  }

  return res.status(404).json({ general: 'Team not found' })
}
