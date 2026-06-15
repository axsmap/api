const mongoose = require('mongoose');

const { User } = require('../../models/user');

/**
 * Run the user-profile aggregation against an arbitrary $match stage.
 * Returns the shaped response object, or null when no user matches.
 */
async function getUserResponse(matchStage, collation) {
  const cursor = User.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'events',
        // Pass user._id and user.teams into the sub-pipeline so each event can:
        //   - count THIS user's reviews scoped to THIS event (reviewsAmount)
        //   - find which of the user's teams (if any) is also on this event (team)
        let: { userEvents: '$events', userId: '$_id', userTeams: '$teams' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: ['$_id', { $ifNull: ['$$userEvents', []] }] },
                  { $in: ['$$userId', { $ifNull: ['$managers', []] }] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'reviews',
              let: { eventId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$event', '$$eventId'] },
                        { $eq: ['$user', '$$userId'] },
                        { $ne: ['$isBanned', true] }
                      ]
                    }
                  }
                },
                { $count: 'n' }
              ],
              as: '_userReviewCount'
            }
          },
          {
            $lookup: {
              from: 'teams',
              let: { eventTeams: '$teams' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $in: ['$_id', { $ifNull: ['$$eventTeams', []] }] },
                        { $in: ['$_id', { $ifNull: ['$$userTeams', []] }] }
                      ]
                    }
                  }
                },
                { $project: { _id: 0, id: '$_id', name: 1, avatar: 1 } },
                { $limit: 1 }
              ],
              as: '_userTeam'
            }
          },
          {
            $lookup: {
              from: 'donations',
              let: { eventId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$event', '$$eventId'] },
                        { $eq: ['$creditedUser', '$$userId'] },
                        { $eq: ['$status', 'confirmed'] }
                      ]
                    }
                  }
                },
                {
                  $group: {
                    _id: null,
                    amountCents: { $sum: '$amountCents' },
                    supportersCount: { $sum: 1 }
                  }
                }
              ],
              as: '_confirmedDonations'
            }
          },
          {
            // Per-event participation row carries personalGoal + hiddenFromProfile.
            // May be absent for events the user joined before EventParticipant
            // rows were created — $ifNull supplies defaults below.
            $lookup: {
              from: 'eventparticipants',
              let: { eventId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$event', '$$eventId'] },
                        { $eq: ['$user', '$$userId'] }
                      ]
                    }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    personalGoal: 1,
                    fundraisingGoal: 1,
                    fundraisingAmountRaised: 1,
                    hiddenFromProfile: 1
                  }
                },
                { $limit: 1 }
              ],
              as: '_participation'
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              endDate: 1,
              name: 1,
              poster: 1,
              startDate: 1,
              reviewsAmount: {
                $ifNull: [{ $arrayElemAt: ['$_userReviewCount.n', 0] }, 0]
              },
              status: {
                $cond: [{ $lt: ['$endDate', '$$NOW'] }, 'completed', 'active']
              },
              isParticipant: {
                $in: ['$_id', { $ifNull: ['$$userEvents', []] }]
              },
              isOrganizer: {
                $in: ['$$userId', { $ifNull: ['$managers', []] }]
              },
              team: { $arrayElemAt: ['$_userTeam', 0] },
              personalGoal: {
                $ifNull: [
                  { $arrayElemAt: ['$_participation.personalGoal', 0] },
                  15
                ]
              },
              fundraisingGoal: {
                $ifNull: [
                  { $arrayElemAt: ['$_participation.fundraisingGoal', 0] },
                  0
                ]
              },
              fundraisingAmountRaised: {
                $divide: [
                  {
                    $ifNull: [
                      {
                        $arrayElemAt: ['$_confirmedDonations.amountCents', 0]
                      },
                      0
                    ]
                  },
                  100
                ]
              },
              fundraisingSupportersCount: {
                $ifNull: [
                  {
                    $arrayElemAt: ['$_confirmedDonations.supportersCount', 0]
                  },
                  0
                ]
              },
              hiddenFromProfile: {
                $ifNull: [
                  { $arrayElemAt: ['$_participation.hiddenFromProfile', 0] },
                  false
                ]
              }
            }
          }
        ],
        as: 'events'
      }
    },
    {
      $lookup: {
        from: 'teams',
        let: { teams: '$teams' },
        pipeline: [
          { $match: { $expr: { $in: ['$_id', '$$teams'] } } },
          {
            $project: { _id: 0, id: '$_id', avatar: 1, name: 1 }
          }
        ],
        as: 'teams'
      }
    },
    {
      $lookup: {
        from: 'users',
        let: { reviewsAmount: '$reviewsAmount' },
        pipeline: [
          { $match: { $expr: { $gt: ['$reviewsAmount', '$$reviewsAmount'] } } },
          { $count: 'ranking' }
        ],
        as: 'ranking'
      }
    },
    {
      $lookup: {
        from: 'donations',
        let: { userId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$creditedUser', '$$userId'] },
                  { $eq: ['$status', 'confirmed'] }
                ]
              }
            }
          },
          { $sort: { amountCents: -1, confirmedAt: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'events',
              localField: 'event',
              foreignField: '_id',
              as: '_event'
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              name: {
                $cond: ['$anonymous', 'Anonymous', '$donorName']
              },
              amount: {
                $cond: [
                  '$showAmountPublicly',
                  { $divide: ['$amountCents', 100] },
                  null
                ]
              },
              eventId: '$event',
              eventName: {
                $ifNull: [{ $arrayElemAt: ['$_event.name', 0] }, 'Mapathon']
              },
              confirmedAt: 1
            }
          }
        ],
        as: 'topSupporters'
      }
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        avatar: 1,
        description: 1,
        disabilities: 1,
        email: 1,
        events: 1,
        firstName: 1,
        gender: 1,
        isSubscribed: 1,
        language: 1,
        lastName: 1,
        phone: 1,
        race: 1,
        birthday: 1,
        disability: 1,
        ranking: 1,
        reviewsAmount: 1,
        showDisabilities: 1,
        showEmail: 1,
        showPhone: 1,
        teams: 1,
        topSupporters: 1,
        username: 1,
        zip: 1,
        aboutMe: { $ifNull: ['$aboutMe', ''] },
        lastLocation: { $ifNull: ['$lastLocation', { lat: null, lng: null }] },
        // Phase 2 fields — defaults applied here because aggregation pipelines
        // don't apply mongoose schema defaults for absent fields. Existing
        // 14k user docs don't have these set yet; new edits will persist them.
        displayName: { $ifNull: ['$displayName', null] },
        socials: {
          $ifNull: [
            '$socials',
            { twitter: '', linkedin: '', instagram: '', website: '' }
          ]
        },
        profilePublic: { $ifNull: ['$profilePublic', false] },
        hideLocation: { $ifNull: ['$hideLocation', false] },
        hideBadges: { $ifNull: ['$hideBadges', false] },
        hideSupporters: { $ifNull: ['$hideSupporters', false] },
        hideSocials: { $ifNull: ['$hideSocials', false] },
        isArchived: 1,
        isBlocked: 1
      }
    }
  ]);

  if (collation) cursor.collation(collation);
  const results = await cursor;
  return results.length ? results[0] : null;
}

function shapeResponse(user) {
  const ranking = user.ranking.length ? user.ranking[0].ranking + 1 : 1;
  const {
    isArchived: _isArchived,
    isBlocked: _isBlocked,
    ...publicFields
  } = user;
  return { ...publicFields, ranking };
}

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  let user;
  try {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    user = await getUserResponse({ _id: userIdObj });
  } catch (err) {
    if (err.name === 'CastError' || err.name === 'BSONError') {
      return res.status(404).json({ general: 'User not found' });
    }

    console.log(`User ${userId} failed to be found at get-user`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' });
  }

  return res.status(200).json(shapeResponse(user));
};

module.exports.getUserResponse = getUserResponse;
module.exports.shapeResponse = shapeResponse;
