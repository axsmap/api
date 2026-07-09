const moment = require('moment');

const getSort = sortBy => {
  if (sortBy.charAt(0) === '-') {
    return { [sortBy.slice(1)]: -1 };
  }

  return { [sortBy]: 1 };
};

const applyStatusFilter = (eventsQuery, status) => {
  const now = moment()
    .utc()
    .toDate();

  if (status === 'active') {
    eventsQuery.startDate = { $lte: now };
    eventsQuery.endDate = { $gte: now };
  } else if (status === 'inactive') {
    eventsQuery.endDate = { $lt: now };
  } else if (status === 'upcoming') {
    eventsQuery.startDate = {
      $gte: moment()
        .startOf('day')
        .utc()
        .toDate()
    };
  } else if (status === 'draft') {
    eventsQuery.status = 'draft';
  }
};

const eventListPipeline = ({ eventsQuery, sortBy, page, pageLimit }) => [
  { $match: eventsQuery },
  {
    $lookup: {
      from: 'users',
      localField: 'managers',
      foreignField: '_id',
      as: 'managerDocs'
    }
  },
  {
    $lookup: {
      from: 'users',
      localField: 'participants',
      foreignField: '_id',
      as: 'participantDocs'
    }
  },
  {
    $project: {
      _id: 0,
      id: '$_id',
      address: 1,
      createdAt: 1,
      description: 1,
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
          input: '$managerDocs',
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
          input: '$participantDocs',
          as: 'participant',
          in: {
            id: '$$participant._id',
            avatar: '$$participant.avatar',
            displayName: '$$participant.displayName',
            firstName: '$$participant.firstName',
            lastName: '$$participant.lastName',
            username: '$$participant.username'
          }
        }
      }
    }
  },
  { $sort: getSort(sortBy) },
  { $skip: page * pageLimit },
  { $limit: pageLimit }
];

module.exports = {
  applyStatusFilter,
  eventListPipeline,
  getSort
};
