const { Event } = require('../../models/event');
const { Team } = require('../../models/team');

module.exports = async (req, res, next) => {
  const getUserTeams = req.user.teams.map(t => Team.findOne({ _id: t }));
  let userTeams;
  try {
    userTeams = await Promise.all(getUserTeams);
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
          id: t.id.toString(),
          avatar: t.avatar,
          name: t.name
        });
      } else {
        teams.push({
          id: t.id.toString(),
          avatar: t.avatar,
          name: t.name
        });
      }
    }
  });

  const getUserEvents = req.user.events.map(e => Event.findOne({ _id: e }));
  let userEvents;
  try {
    userEvents = await Promise.all(getUserEvents);
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
          id: e.id.toString(),
          endDate: e.endDate,
          name: e.name,
          poster: e.poster,
          startDate: e.startDate
        });
      } else {
        events.push({
          id: e.id.toString(),
          endDate: e.endDate,
          name: e.name,
          poster: e.poster,
          startDate: e.startDate
        });
      }
    }
  });

  const userData = {
    id: req.user.id,
    avatar: req.user.avatar,
    description: req.user.description,
    disabilities: req.user.disabilities,
    email: req.user.email,
    events,
    firstName: req.user.firstName,
    gender: req.user.gender,
    isSubscribed: req.user.isSubscribed,
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
