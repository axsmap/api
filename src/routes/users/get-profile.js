const { ObjectId } = require('mongodb');

const { markUserOpened } = require('../../helpers/user-activity');
const { getDb } = require('../events/leaderboard-helpers');

module.exports = async (req, res, next) => {
  try {
    const openedAt = new Date();
    await markUserOpened(req.user.id, openedAt);
    req.user.lastOpenedAt = openedAt;
  } catch (err) {
    console.log(`User ${req.user.id} failed to mark opened at get-profile.`);
    return next(err);
  }

  let userTeams;
  try {
    const db = await getDb();
    const teamIds = (req.user.teams || []).map(t => new ObjectId(t));
    userTeams = teamIds.length
      ? await db
          .collection('teams')
          .find({ _id: { $in: teamIds } })
          .toArray()
      : [];
  } catch (err) {
    console.log('Teams failed to be found at get-profile');
    return next(err);
  }

  const teams = [];
  const managedTeams = [];
  userTeams.map(t => {
    if (t) {
      const teamManagers = t.managers.map(m => m.toString());
      if (teamManagers.includes(req.user.id)) {
        managedTeams.push({
          id: t._id.toString(),
          avatar: t.avatar,
          name: t.name
        });
      } else {
        teams.push({
          id: t._id.toString(),
          avatar: t.avatar,
          name: t.name
        });
      }
    }
  });

  let userEvents;
  try {
    const db = await getDb();
    const eventIds = (req.user.events || []).map(e => new ObjectId(e));
    userEvents = eventIds.length
      ? await db
          .collection('events')
          .find({ _id: { $in: eventIds } })
          .toArray()
      : [];
  } catch (err) {
    console.log('Events failed to be found at get-profile');
    return next(err);
  }

  const events = [];
  const managedEvents = [];
  userEvents.map(e => {
    if (e) {
      const eventManagers = e.managers.map(m => m.toString());
      if (eventManagers.includes(req.user.id)) {
        managedEvents.push({
          id: e._id.toString(),
          endDate: e.endDate,
          name: e.name,
          poster: e.poster,
          startDate: e.startDate
        });
      } else {
        events.push({
          id: e._id.toString(),
          endDate: e.endDate,
          name: e.name,
          poster: e.poster,
          startDate: e.startDate
        });
      }
    }
  });

  let blockedUsers = [];
  try {
    const db = await getDb();
    const blockedUserIds = (req.user.blockedUsers || []).map(
      u => new ObjectId(u)
    );
    blockedUsers = blockedUserIds.length
      ? await db
          .collection('users')
          .find(
            { _id: { $in: blockedUserIds }, isArchived: false },
            {
              projection: {
                _id: 1,
                avatar: 1,
                firstName: 1,
                lastName: 1,
                username: 1
              }
            }
          )
          .toArray()
      : [];
    blockedUsers = blockedUsers.map(user => ({
      id: user._id.toString(),
      avatar: user.avatar,
      displayName: user.displayName || null,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username
    }));
  } catch (err) {
    console.log('Blocked users failed to be found at get-profile');
    return next(err);
  }

  const userData = {
    id: req.user.id,
    avatar: req.user.avatar,
    blockedUsers,
    connectionPreference: req.user.connectionPreference || 'mapathon',
    description: req.user.description,
    displayName: req.user.displayName || null,
    disabilities: req.user.disabilities,
    email: req.user.email,
    events,
    firstName: req.user.firstName,
    gender: req.user.gender,
    isSubscribed: req.user.isSubscribed,
    lastOpenedAt: req.user.lastOpenedAt,
    lastName: req.user.lastName,
    managedEvents,
    managedTeams,
    phone: req.user.phone,
    reviewFieldsAmount: req.user.reviewFieldsAmount,
    reviewsAmount: req.user.reviewsAmount,
    showDisabilities: req.user.showDisabilities,
    showEmail: req.user.showEmail,
    showPhone: req.user.showPhone,
    teams,
    username: req.user.username,
    zip: req.user.zip
  };
  return res.status(200).json(userData);
};
