const mongoose = require('mongoose');

const { User } = require('../../models/user');

const getUserResponse = async (matchStage, collation) => {
  const cursor = User.aggregate([
    {
      $match: matchStage
    },
    {
      $lookup: {
        from: 'events',
        let: { events: '$events', userId: '$_id', userTeams: '$teams' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: ['$_id', { $ifNull: ['$$events', []] }] },
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
                        { $eq: ['$type', 'pledge'] },
                        { $in: ['$status', ['pledged', 'approved']] }
                      ]
                    }
                  }
                },
                { $sort: { createdAt: -1 } },
                {
                  $lookup: {
                    from: 'reviews',
                    let: {
                      pledgeEventId: '$event',
                      pledgeUserId: '$creditedUser',
                      pledgedAt: '$createdAt'
                    },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ['$event', '$$pledgeEventId'] },
                              { $eq: ['$user', '$$pledgeUserId'] },
                              { $ne: ['$isBanned', true] },
                              { $gt: ['$createdAt', '$$pledgedAt'] }
                            ]
                          }
                        }
                      },
                      { $group: { _id: '$venue' } },
                      { $count: 'n' }
                    ],
                    as: '_postPledgeReviewCount'
                  }
                },
                {
                  $project: {
                    _id: 0,
                    id: '$_id',
                    eventId: '$event',
                    name: {
                      $cond: ['$anonymous', 'Anonymous', '$donorName']
                    },
                    pledgeAmount: { $divide: ['$pledgeAmountCents', 100] },
                    pledgeCap: { $divide: ['$pledgeCapCents', 100] },
                    status: 1,
                    anonymous: 1,
                    showAmountPublicly: { $literal: true },
                    showPledgePublicly: { $literal: true },
                    mappedCount: {
                      $ifNull: [
                        { $arrayElemAt: ['$_postPledgeReviewCount.n', 0] },
                        0
                      ]
                    },
                    createdAt: 1
                  }
                }
              ],
              as: '_publicPledges'
            }
          },
          {
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
                $in: ['$_id', { $ifNull: ['$$events', []] }]
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
              pledges: '$_publicPledges',
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
          {
            $match: {
              $expr: {
                $in: ['$_id', '$$teams']
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
        as: 'teams'
      }
    },
    {
      $lookup: {
        from: 'users',
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
          { $sort: { confirmedAt: -1, amountCents: -1 } },
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
        aboutMe: { $ifNull: ['$aboutMe', ''] },
        id: '$_id',
        avatar: 1,
        birthday: 1,
        description: 1,
        disability: 1,
        disabilities: 1,
        displayName: { $ifNull: ['$displayName', null] },
        email: 1,
        events: 1,
        firstName: 1,
        gender: 1,
        hideBadges: { $ifNull: ['$hideBadges', false] },
        hideLocation: { $ifNull: ['$hideLocation', false] },
        hideSocials: { $ifNull: ['$hideSocials', false] },
        hideSupporters: { $ifNull: ['$hideSupporters', false] },
        isArchived: 1,
        isBlocked: 1,
        isSubscribed: 1,
        language: 1,
        lastLocation: { $ifNull: ['$lastLocation', { lat: null, lng: null }] },
        lastName: 1,
        phone: 1,
        profilePublic: { $ifNull: ['$profilePublic', true] },
        publicVisibility: { $ifNull: ['$publicVisibility', 'displayName'] },
        race: 1,
        ranking: 1,
        reviewsAmount: 1,
        showDisabilities: 1,
        showEmail: 1,
        showPhone: 1,
        socials: {
          $ifNull: [
            '$socials',
            { twitter: '', linkedin: '', instagram: '', website: '' }
          ]
        },
        teams: 1,
        topSupporters: 1,
        username: 1,
        zip: 1
      }
    }
  ]);

  if (collation) {
    cursor.collation(collation);
  }

  const users = await cursor;
  return users.length ? users[0] : null;
};

const shapeResponse = user => {
  const publicFields = Object.assign({}, user);
  delete publicFields.isArchived;
  delete publicFields.isBlocked;

  return Object.assign({}, publicFields, {
    ranking: user.ranking.length ? user.ranking[0].ranking + 1 : 1
  });
};

const getUser = async (req, res, next) => {
  const userId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(404).json({ general: 'User not found' });
  }

  let user;
  try {
    const userIdObj = mongoose.Types.ObjectId(userId);
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

module.exports = getUser;
module.exports.getUserResponse = getUserResponse;
module.exports.shapeResponse = shapeResponse;
