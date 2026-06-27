const moment = require("moment");

const { Event } = require("../../models/event");
const { cleanSpaces } = require("../../helpers");
const { Photo } = require("../../models/photo");
const { Team } = require("../../models/team");
const { User } = require("../../models/user");

const { validateCreateEvent } = require("./validations");
const { sendError } = require("../../helpers/Error");

module.exports = async (req, res, next) => {
  const data = {
    address: req.body.address,
    description: req.body.description,
    donationAmounts: req.body.donationAmounts,
    donationEnabled: req.body.donationEnabled,
    donationGoal: req.body.donationGoal,
    endDate: req.body.endDate,
    isInviteOnly: req.body.isInviteOnly,
    isOpen: req.body.isOpen,
    locationCoordinates: req.body.locationCoordinates,
    name: req.body.name,
    participantsGoal: req.body.participantsGoal,
    poster: req.body.poster,
    reviewsGoal: req.body.reviewsGoal,
    startDate: req.body.startDate,
    status: req.body.status,
    teamManager: req.body.teamManager,
  };

  const { errors, isValid } = validateCreateEvent(data);
  if (!isValid) return res.status(400).json(sendError(errors));

  data.address = cleanSpaces(data.address);

  data.endDate = moment(data.endDate).endOf("day").toDate();
  data.startDate = moment(data.startDate).startOf("day").toDate();

  data.location = {
    coordinates: [data.locationCoordinates[1], data.locationCoordinates[0]],
  };
  delete data.locationCoordinates;

  data.managers = [req.user.id];

  data.name = cleanSpaces(data.name);

  if (data.poster) {
    let poster;
    try {
      poster = await Photo.findOne({ url: data.poster });
    } catch (err) {
      console.log(`Poster ${data.poster} failed to be found at create-event`);
      return next(err);
    }

    if (!poster) {
      return res.status(404).json(sendError({ poster: "Not found" }));
    }
  }

  if (data.teamManager) {
    let team;
    try {
      team = await Team.findOne({ _id: data.teamManager, isArchived: false });
    } catch (err) {
      console.log(
        `Team ${data.teamManager} failed to be found at create-event`
      );
      return next(err);
    }

    if (!team) {
      return res.status(404).json(sendError({ teamManager: "Not found" }));
    }

    const teamManagers = team.managers.map((m) => m.toString());
    if (!teamManagers.includes(req.user.id)) {
      return res.status(403).json(sendError({ general: "Forbidden action" }));
    }
  } else {
    data.teamManager = undefined;
  }

  let event;
  try {
    event = await Event.create(data);
  } catch (err) {
    if (typeof err.errors === "object") {
      const validationErrors = {};

      Object.keys(err.errors).forEach((key) => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(
      `Event failed to be created at create-event.\nData: ${JSON.stringify(
        data
      )}`
    );
    return next(err);
  }

  try {
    await User.findByIdAndUpdate(req.user.id, {
      $push: { events: event.id },
      $set: { updatedAt: moment.utc().toDate() }
    });
  } catch (err) {
    console.log(`User ${req.user.id} failed to be updated at create-event`);
    return next(err);
  }

  let eventLocation;
  if (event.location.coordinates) {
    eventLocation = {
      lat: event.location.coordinates[1],
      lng: event.location.coordinates[0],
    };
  }
  const dataResponse = {
    id: event.id,
    address: event.address,
    description: event.description,
    endDate: event.endDate,
    startDate: event.startDate,
    isInviteOnly: event.isInviteOnly,
    isOpen: event.isOpen,
    location: eventLocation,
    managers: event.managers,
    name: event.name,
    participantsGoal: event.participantsGoal,
    poster: event.poster,
    reviewsGoal: event.reviewsGoal,
    status: event.status,
    teamManager: event.teamManager,
  };

  return res.status(201).json(dataResponse);
};
