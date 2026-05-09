const axios = require('axios');
const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { Review } = require('../../models/review');
const { User } = require('../../models/user');

const getUsername = user => {
  if (user.username) return user.username;

  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') || 'AXS Mapper'
  );
};

const normalizeLeaderboardItem = mapathonId => (item, index) => ({
  rank: index + 1,
  username: getUsername(item),
  placesMapped: item.placesMapped || item.reviewsAmount || 0,
  userId: (item.userId || item.id).toString(),
  mapathonId: mapathonId ? mapathonId.toString() : null
});

const getLeaderboards = async eventId =>
  Promise.all([
    User.aggregate([
      {
        $match: {
          isArchived: false,
          isBlocked: false,
          reviewsAmount: { $gt: 0 }
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          firstName: 1,
          lastName: 1,
          username: 1,
          reviewsAmount: 1
        }
      },
      {
        $sort: {
          reviewsAmount: -1,
          username: 1,
          firstName: 1,
          lastName: 1
        }
      },
      { $limit: 20 }
    ]),
    Review.aggregate([
      {
        $match: {
          event: eventId,
          isBanned: false
        }
      },
      {
        $group: {
          _id: '$user',
          placesMapped: { $sum: 1 }
        }
      },
      {
        $sort: {
          placesMapped: -1,
          _id: 1
        }
      },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          username: '$user.username',
          placesMapped: 1
        }
      }
    ])
  ]).then(([overall, mapathon]) => ({
    overall: overall.map(normalizeLeaderboardItem(null)),
    mapathon: mapathon.map(normalizeLeaderboardItem(eventId))
  }));

module.exports = async (req, res, next) => {
  let eventId = req.params.eventId;
  if (!isMongoId(eventId)) {
    return res.status(400).json({ general: 'Event not found' });
  }
  eventId = mongoose.Types.ObjectId(eventId);

  let event;
  try {
    event = await Event.aggregate([
      {
        $match: { _id: eventId }
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
                lastName: 1
              }
            }
          ],
          as: 'managers'
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { participants: '$participants' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$participants']
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
          as: 'participants'
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
          from: 'teams',
          let: { teamManager: '$teamManager' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$teamManager']
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
          as: 'teamManager'
        }
      },
      {
        $unwind: {
          path: '$teamManager',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'events',
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
          address: 1,
          description: 1,
          donationAmounts: 1,
          donationId: 1,
          endDate: 1,
          isOpen: 1,
          location: 1,
          managers: 1,
          name: 1,
          participants: 1,
          participantsGoal: 1,
          poster: 1,
          ranking: 1,
          reviewsAmount: 1,
          reviewsGoal: 1,
          startDate: 1,
          teamManager: 1,
          teams: 1
        }
      }
    ]);
  } catch (err) {
    console.log(`Event ${eventId} failed to be found at get-event`);
    return next(err);
  }

  if (!event.length) {
    return res.status(404).json({ general: 'Event not found' });
  }

  let leaderboards;
  try {
    leaderboards = await getLeaderboards(eventId);
  } catch (err) {
    console.log(
      `Leaderboards for event ${eventId} failed to be found at get-event`
    );
    return next(err);
  }

  const dataResponse = Object.assign({}, event[0], {
    ranking: event[0].ranking.length ? event[0].ranking[0].ranking + 1 : 1,
    leaderboards
  });

  if (dataResponse.donationId) {
    let options = {
      method: 'GET',
      url: `https://${
        process.env.DONATELY_SUBDOMAIN
      }.dntly.com/api/v1/admin/campaigns/${dataResponse.donationId}`,
      auth: {
        username: process.env.DONATELY_TOKEN,
        password: ''
      }
    };

    let response;
    try {
      response = await axios(options);
    } catch (err) {
      console.log('Donation campaign failed to be found at get-event.');
      return next(err);
    }

    dataResponse.donationAmountRaised = response.data.campaign.amount_raised;
    dataResponse.donationDonorsCount = response.data.campaign.donors_count;
    dataResponse.donationGoal = response.data.campaign.campaign_goal;
  }

  return res.status(200).json(dataResponse);
};
