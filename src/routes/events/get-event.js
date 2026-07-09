const axios = require('axios');
const { ObjectId } = require('mongodb');
const { isMongoId } = require('validator');

const { getDb } = require('./leaderboard-helpers');

const logTrace = (requestId, step, startedAt, extra = {}) => {
  console.log('[events:get-event:trace]', {
    requestId,
    step,
    elapsedMs: Date.now() - startedAt,
    ...extra
  });
};

const timeStep = async (
  requestId,
  requestStartedAt,
  step,
  work,
  extra = {}
) => {
  const stepStartedAt = Date.now();

  try {
    const result = await work();
    logTrace(requestId, step, requestStartedAt, {
      durationMs: Date.now() - stepStartedAt,
      ...extra
    });
    return result;
  } catch (err) {
    logTrace(requestId, `${step}:error`, requestStartedAt, {
      durationMs: Date.now() - stepStartedAt,
      message: err.message,
      ...extra
    });
    throw err;
  }
};

const getDeferredLeaderboards = (requestId, startedAt, eventId) => {
  // Keep event details fast: leaderboard aggregation scans reviews and is
  // served by /events/leaderboard/overall and /events/:eventId/leaderboard.
  logTrace(
    requestId,
    'leaderboards.deferred-to-dedicated-endpoints',
    startedAt,
    {
      eventId: eventId.toString()
    }
  );

  return {
    overall: [],
    mapathon: []
  };
};

module.exports = async (req, res, next) => {
  const startedAt = Date.now();
  const mapathonId = req.params.eventId;
  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  logTrace(requestId, 'start', startedAt, {
    eventId: mapathonId,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  if (!isMongoId(mapathonId)) {
    logTrace(requestId, 'invalid-id', startedAt, { eventId: mapathonId });
    return res.status(400).json({ general: 'Event not found' });
  }

  const eventId = new ObjectId(mapathonId);

  let event;
  const leaderboards = getDeferredLeaderboards(requestId, startedAt, eventId);
  try {
    const db = await timeStep(requestId, startedAt, 'mongodb.get-db', getDb);

    event = await timeStep(
      requestId,
      startedAt,
      'mongodb.event-detail-aggregate',
      () =>
        db
          .collection('events')
          .aggregate([
            { $match: { _id: eventId } },
            {
              $lookup: {
                from: 'users',
                localField: 'managers',
                foreignField: '_id',
                as: 'managers'
              }
            },
            {
              $lookup: {
                from: 'users',
                localField: 'participants',
                foreignField: '_id',
                as: 'participants'
              }
            },
            {
              $lookup: {
                from: 'teams',
                localField: 'teams',
                foreignField: '_id',
                as: 'teams'
              }
            },
            {
              $lookup: {
                from: 'teams',
                localField: 'teamManager',
                foreignField: '_id',
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
              $project: {
                _id: 0,
                id: '$_id',
                address: 1,
                description: 1,
                donationAmounts: 1,
                donationEnabled: 1,
                donationGoal: 1,
                donationId: 1,
                endDate: 1,
                isOpen: 1,
                location: 1,
                name: 1,
                participantsGoal: 1,
                poster: 1,
                reviewsAmount: 1,
                reviewsGoal: 1,
                startDate: 1,
                status: 1,
                managers: {
                  $map: {
                    input: '$managers',
                    as: 'manager',
                    in: {
                      id: '$$manager._id',
                      avatar: '$$manager.avatar',
                      displayName: '$$manager.displayName',
                      firstName: '$$manager.firstName',
                      lastName: '$$manager.lastName',
                      username: '$$manager.username'
                    }
                  }
                },
                participants: {
                  $map: {
                    input: '$participants',
                    as: 'participant',
                    in: {
                      id: '$$participant._id',
                      avatar: '$$participant.avatar',
                      displayName: '$$participant.displayName',
                      firstName: '$$participant.firstName',
                      lastName: '$$participant.lastName',
                      username: '$$participant.username',
                      reviewsAmount: '$$participant.reviewsAmount'
                    }
                  }
                },
                teams: {
                  $map: {
                    input: '$teams',
                    as: 'team',
                    in: {
                      id: '$$team._id',
                      avatar: '$$team.avatar',
                      name: '$$team.name'
                    }
                  }
                },
                teamManager: {
                  id: '$teamManager._id',
                  avatar: '$teamManager.avatar',
                  name: '$teamManager.name'
                }
              }
            }
          ])
          .next(),
      { collection: 'events', eventId: eventId.toString() }
    );
    logTrace(requestId, 'event-ready', startedAt, {
      foundEvent: Boolean(event)
    });

    if (event) {
      event.ranking = await timeStep(
        requestId,
        startedAt,
        'mongodb.ranking-count',
        async () =>
          (await db.collection('events').countDocuments({
            isArchived: false,
            reviewsAmount: { $gt: event.reviewsAmount || 0 },
            _id: { $ne: eventId }
          })) + 1,
        { collection: 'events', reviewsAmount: event.reviewsAmount || 0 }
      );
    }
  } catch (err) {
    console.log(`Event ${eventId} failed to be found at get-event`);
    return next(err);
  }

  if (!event) {
    logTrace(requestId, 'not-found', startedAt);
    return res.status(404).json({ general: 'Event not found' });
  }

  const dataResponse = await timeStep(
    requestId,
    startedAt,
    'backend.response-shape',
    () => ({
      ...event,
      leaderboards
    })
  );

  if (dataResponse.donationId) {
    logTrace(requestId, 'donately-start', startedAt, {
      donationId: dataResponse.donationId
    });

    const options = {
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
      response = await timeStep(
        requestId,
        startedAt,
        'external.donately-campaign',
        () => axios(options),
        { donationId: dataResponse.donationId }
      );
      dataResponse.donationAmountRaised = response.data.campaign.amount_raised;
      dataResponse.donationDonorsCount = response.data.campaign.donors_count;
      dataResponse.donationGoal = response.data.campaign.campaign_goal;
    } catch (err) {
      console.log('Donation campaign failed to be found at get-event.');
      dataResponse.donationAmountRaised = 0;
      dataResponse.donationDonorsCount = 0;
      dataResponse.donationGoal = dataResponse.donationGoal || 0;
      logTrace(requestId, 'donately-error', startedAt, {
        message: err.message
      });
    }
  }

  logTrace(requestId, 'response', startedAt, { status: 200 });
  return res.status(200).json(dataResponse);
};
