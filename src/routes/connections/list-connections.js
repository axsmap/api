const { getDb } = require('../events/leaderboard-helpers');
const { connectionProjection, toObjectId } = require('./helpers');

const userProjection = prefix => ({
  id: `$${prefix}._id`,
  avatar: `$${prefix}.avatar`,
  displayName: `$${prefix}.displayName`,
  firstName: `$${prefix}.firstName`,
  lastName: `$${prefix}.lastName`
});

module.exports = async (req, res, next) => {
  const userId = toObjectId(req.user.id);
  const state = req.query.state || 'accepted';
  const states =
    state === 'all' ? ['accepted', 'pending', 'declined'] : [state];

  if (!['accepted', 'pending', 'declined', 'all'].includes(state)) {
    return res.status(400).json({ state: 'Should be a valid state' });
  }

  let connections;
  try {
    const db = await getDb();
    connections = await db
      .collection('connections')
      .aggregate([
        {
          $match: {
            state: { $in: states },
            $or: [{ requester: userId }, { recipient: userId }]
          }
        },
        { $sort: { updatedAt: -1, createdAt: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'requester',
            foreignField: '_id',
            as: 'requester'
          }
        },
        { $unwind: '$requester' },
        {
          $lookup: {
            from: 'users',
            localField: 'recipient',
            foreignField: '_id',
            as: 'recipient'
          }
        },
        { $unwind: '$recipient' },
        {
          $lookup: {
            from: 'events',
            let: {
              sharedEventIds: {
                $map: {
                  input: { $ifNull: ['$sharedEvents', []] },
                  as: 'eventId',
                  in: { $toString: '$$eventId' }
                }
              }
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [{ $toString: '$_id' }, '$$sharedEventIds']
                  }
                }
              }
            ],
            as: 'sharedEvents'
          }
        },
        {
          $lookup: {
            from: 'events',
            let: {
              requesterId: '$requester._id',
              recipientId: '$recipient._id'
            },
            pipeline: [
              {
                $match: {
                  isArchived: false,
                  $expr: {
                    $and: [
                      {
                        $in: [
                          '$$requesterId',
                          {
                            $concatArrays: [
                              { $ifNull: ['$participants', []] },
                              { $ifNull: ['$managers', []] }
                            ]
                          }
                        ]
                      },
                      {
                        $in: [
                          '$$recipientId',
                          {
                            $concatArrays: [
                              { $ifNull: ['$participants', []] },
                              { $ifNull: ['$managers', []] }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                }
              },
              { $sort: { endDate: -1, startDate: -1 } }
            ],
            as: 'inferredSharedEvents'
          }
        },
        {
          $project: {
            ...connectionProjection,
            requester: userProjection('requester'),
            recipient: userProjection('recipient'),
            sharedEvents: {
              $map: {
                input: {
                  $cond: [
                    { $gt: [{ $size: '$sharedEvents' }, 0] },
                    '$sharedEvents',
                    { $slice: ['$inferredSharedEvents', 1] }
                  ]
                },
                as: 'event',
                in: {
                  id: '$$event._id',
                  endDate: '$$event.endDate',
                  name: '$$event.name',
                  startDate: '$$event.startDate'
                }
              }
            }
          }
        }
      ])
      .toArray();
  } catch (err) {
    console.log(`Connections for user ${req.user.id} failed to be found`);
    return next(err);
  }

  return res.status(200).json({ results: connections });
};
