const { Event } = require("../../models/event");
const { Team } = require("../../models/team");
const { User } = require("../../models/user");

module.exports = async (req, res, next) => {
  const getUserTeams = req.user.teams.map((t) => Team.findOne({ _id: t }));
  let userTeams;
  try {
    userTeams = await Promise.all(getUserTeams);
  } catch (err) {
    console.log("Teams failed to be found at get-profile");
    return next(err);
  }

  const teams = [];
  const managedTeams = [];
  userTeams.map((t) => {
    if (t) {
      const teamManagers = t.managers.map((m) => m.toString());
      if (teamManagers.includes(req.user.id)) {
        managedTeams.push({
          id: t.id.toString(),
          avatar: t.avatar,
          name: t.name,
        });
      } else {
        teams.push({
          id: t.id.toString(),
          avatar: t.avatar,
          name: t.name,
        });
      }
    }
  });

  const getUserEvents = req.user.events.map((e) => Event.findOne({ _id: e }));
  let userEvents;
  try {
    userEvents = await Promise.all(getUserEvents);
  } catch (err) {
    console.log("Events failed to be found at get-profile");
    return next(err);
  }

  const events = [];
  const managedEvents = [];
  userEvents.map((e) => {
    if (e) {
      const eventManagers = e.managers.map((m) => m.toString());
      if (eventManagers.includes(req.user.id)) {
        managedEvents.push({
          id: e.id.toString(),
          endDate: e.endDate,
          name: e.name,
          poster: e.poster,
          startDate: e.startDate,
        });
      } else {
        events.push({
          id: e.id.toString(),
          endDate: e.endDate,
          name: e.name,
          poster: e.poster,
          startDate: e.startDate,
        });
      }
    }
  });
  console.log(req.user.reviewsAmount, typeof req.user.reviewsAmount);

  const ranking =
    (await User.countDocuments({
      reviewsAmount: { $gt: req.user.reviewsAmount ?? 0 },
    })) + 1;

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
    zip: req.user.zip,
    avatar: req.user.avatar,
    race: req.user?.race,
    birthday: req.user?.birthday,
    disability: req.user.disability,
    ranking,
    aboutMe: req.user.aboutMe,
    isAdmin: req.user.isAdmin === true,
    // Phase 2 profile fields (defaults applied here because req.user is a
    // mongoose doc; absent fields come through as undefined).
    displayName: req.user.displayName ?? null,
    socials: req.user.socials || { twitter: "", linkedin: "", instagram: "", website: "" },
    profilePublic: req.user.profilePublic ?? false,
    hideLocation: req.user.hideLocation ?? false,
    hideBadges: req.user.hideBadges ?? false,
    hideSupporters: req.user.hideSupporters ?? false,
    hideSocials: req.user.hideSocials ?? false,
    blockedConnectionUserIds: (req.user.blockedConnectionUserIds || []).map(
      (id) => id.toString()
    ),
  };
  return res.status(200).json(userData);
};
