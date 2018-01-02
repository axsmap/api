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
        $unwind: '$members'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'members',
          foreignField: '_id',
          as: 'membersObj'
        }
      },
      {
        $unwind: '$membersObj'
      },
      {
        $unwind: '$managers'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'managers',
          foreignField: '_id',
          as: 'managersObj'
        }
      },
      {
        $unwind: '$managersObj'
      },
      {
        $unwind: '$events'
      },
      {
        $lookup: {
          from: 'events',
          localField: 'events',
          foreignField: '_id',
          as: 'eventsObj'
        }
      },
      {
        $unwind: '$eventsObj'
      },
      {
        $group: {
          _id: '$_id',
          avatar: { $first: '$avatar' },
          description: { $first: '$description' },
          name: { $first: '$name' },
          events: { $push: '$eventsObj' },
          managers: { $push: '$managersObj' },
          members: { $push: '$membersObj' }
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
    return res.status(200).json(team)
  }

  return res.status(404).json({ general: 'Team not found' })
}
