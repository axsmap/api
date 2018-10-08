const axios = require('axios');
const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');

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

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  const dataResponse = Object.assign({}, event[0], {
    ranking: event[0].ranking.length ? event[0].ranking[0].ranking + 1 : 1
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
