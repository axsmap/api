const moment = require('moment');

const { Event } = require('../../models/event');
const { Petition } = require('../../models/petition');
const { Team } = require('../../models/team');
const { User } = require('../../models/user');

const { validateCreatePetition } = require('./validations');

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateCreatePetition(req.body);
  if (!isValid) return res.status(400).json(errors);

  const data = Object.assign(
    {},
    {
      event: req.body.event,
      message: req.body.message,
      team: req.body.team,
      type: req.body.type,
      user: req.body.user
    }
  );
  data.sender = req.user.id.toString();
  const today = moment.utc();

  if (data.type === 'invite-team-event') {
    delete data.user;

    let petition;
    try {
      petition = await Petition.findOne({
        event: data.event,
        team: data.team,
        type: data.type
      });
    } catch (err) {
      console.log(
        `Petition from event ${data.event} to team ${
          data.team
        } failed to be found at create-petition`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'Team already has a pending invitation to event'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at create-petition`
        );
        return next(err);
      }
    }

    let event;
    try {
      event = await Event.findOne({ _id: data.event });
    } catch (err) {
      console.log(`Event ${data.event} failed to be found at create-petition`);
      return next(err);
    }

    if (!event) return res.status(404).json({ event: 'Not found' });

    if (!event.managers.find(m => m.toString() === data.sender)) {
      return res.status(403).json({ general: 'Forbidden action' });
    }

    if (event.teams.find(t => t.toString() === data.team)) {
      return res.status(400).json({
        general: 'Team is already participant of event'
      });
    }

    const endDate = moment(event.endDate).utc();
    if (endDate.isBefore(today)) {
      return res.status(400).json({ general: 'Event has already finished' });
    }

    let team;
    try {
      team = await Team.findOne({ _id: data.team });
    } catch (err) {
      console.log(`Team ${data.team} failed to be found at create-petition`);
      return next(err);
    }

    if (!team) return res.status(404).json({ general: 'Team not found' });
  } else if (data.type === 'invite-user-event') {
    delete data.team;

    let petition;
    try {
      petition = await Petition.findOne({
        event: data.event,
        type: data.type,
        user: data.user
      });
    } catch (err) {
      console.log(
        `Petition from event ${data.event} to user ${
          data.user
        } failed to be found at create-petition`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'User already has a pending invitation to event'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at create-petition`
        );
        return next(err);
      }
    }

    if (data.sender === data.user) {
      return res.status(400).json({ general: 'User should not be you' });
    }

    let event;
    try {
      event = await Event.findOne({ _id: data.event });
    } catch (err) {
      console.log(`Event ${data.event} failed to be found at create-petition`);
      return next(err);
    }

    if (!event) return res.status(404).json({ general: 'Event not found' });

    if (!event.managers.find(m => m.toString() === data.sender)) {
      return res.status(403).json({ general: 'Forbidden action' });
    }

    if (event.participants.find(p => p.toString() === data.user)) {
      return res.status(400).json({
        general: 'User is already participant of event'
      });
    }

    const endDate = moment(event.endDate).utc();
    if (endDate.isBefore(today)) {
      return res.status(400).json({ general: 'Event has already finished' });
    }

    let user;
    try {
      user = await User.findOne({ _id: data.user });
    } catch (err) {
      console.log(`User ${data.user} failed to be found at create-petition`);
      return next(err);
    }

    if (!user) return res.status(404).json({ general: 'User not found' });
  } else if (data.type === 'invite-user-team') {
    delete data.event;

    let petition;
    try {
      petition = await Petition.findOne({
        team: data.team,
        type: data.type,
        user: data.user
      });
    } catch (err) {
      console.log(
        `Petition from team ${data.team} to user ${
          data.user
        } failed to be found at create-petition`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'User already has a pending invitation to team'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at create-petition`
        );
        return next(err);
      }
    }

    if (req.sender === data.user) {
      return res.status(400).json({ general: 'User should not be you' });
    }

    let team;
    try {
      team = await Team.findOne({ _id: data.team });
    } catch (err) {
      console.log(`Team ${data.team} failed to be found at create-petition`);
      return next(err);
    }

    if (!team) return res.status(404).json({ general: 'Team not found' });

    if (!team.managers.find(m => m.toString() === data.sender)) {
      return res.status(403).json({ general: 'Forbidden action' });
    }

    if (team.members.find(m => m.toString() === data.user)) {
      return res.status(400).json({
        general: 'User is already member of team'
      });
    }

    let user;
    try {
      user = await User.findOne({ _id: data.user });
    } catch (err) {
      console.log(`User ${data.user} failed to be found at create-petition`);
      return next(err);
    }

    if (!user) return res.status(404).json({ general: 'User not found' });
  } else if (data.type === 'request-team-event') {
    delete data.user;

    let petition;
    try {
      petition = await Petition.findOne({
        event: data.event,
        team: data.team,
        type: data.type
      });
    } catch (err) {
      console.log(
        `Petition from team ${data.team} to event ${
          data.event
        } failed to be found at create-petition`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'Team already has a pending request with event'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at create-petition`
        );
        return next(err);
      }
    }

    let event;
    try {
      event = await Event.findOne({ _id: data.event });
    } catch (err) {
      console.log(`Event ${data.event} failed to be found at create-petition`);
      return next(err);
    }

    if (!event) return res.status(404).json({ general: 'Event not found' });

    if (event.teams.find(t => t.toString() === data.sender)) {
      return res.status(400).json({
        general: 'Team is already participant of event '
      });
    }

    const endDate = moment(event.endDate).utc();
    if (endDate.isBefore(today)) {
      return res.status(400).json({ general: 'Event has already finished' });
    }

    let team;
    try {
      team = await Team.findOne({ _id: data.team });
    } catch (err) {
      console.log(`Team ${data.team} failed to be found at create-petition`);
      return next(err);
    }

    if (!team) return res.status(404).json({ general: 'Team not found' });

    if (!team.managers.find(m => m.toString() === data.sender)) {
      return res.status(403).json({ general: 'Forbidden action' });
    }
  } else if (data.type === 'request-user-event') {
    delete data.team;

    let petition;
    try {
      petition = await Petition.findOne({
        event: data.event,
        sender: data.sender,
        type: data.type
      });
    } catch (err) {
      console.log(
        `Petition from user ${data.sender} to event ${
          data.event
        } failed to be found at create-petition`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'User already have a pending request with event'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at create-petition`
        );
        return next(err);
      }
    }

    let event;
    try {
      event = await Event.findOne({ _id: data.event });
    } catch (err) {
      console.log(`Event ${data.event} failed to be found at create-petition`);
      return next(err);
    }

    if (!event) return res.status(404).json({ general: 'Event not found' });

    if (event.participants.find(p => p.toString() === data.sender)) {
      return res.status(400).json({
        general: 'User already is participant of event'
      });
    }

    const endDate = moment(event.endDate).utc();
    if (endDate.isBefore(today)) {
      return res.status(400).json({ general: 'Event has already finished' });
    }
  } else {
    // data.type === request-user-team
    delete data.event;

    let petition;
    try {
      petition = await Petition.findOne({
        team: data.team,
        sender: data.sender,
        type: data.type
      });
    } catch (err) {
      console.log(
        `Petition from user ${data.sender} to team ${
          data.team
        } failed to be found at create-petition`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'User already have a pending request with team'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at create-petition`
        );
        return next(err);
      }
    }

    let team;
    try {
      team = await Team.findOne({ _id: data.team });
    } catch (err) {
      console.log(`Team ${data.team} failed to be found at create-petition`);
      return next(err);
    }

    if (!team) return res.status(404).json({ general: 'Team not found' });

    if (team.members.find(m => m.toString() === data.sender)) {
      return res.status(400).json({
        general: 'User already is member of team'
      });
    }
  }

  let petition;
  try {
    petition = await Petition.create(data);
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(
      `Petition failed to be created at create-petition.\nData: ${JSON.stringify(
        data
      )}`
    );
    return next(err);
  }

  const dataResponse = Object.assign(
    {},
    {
      createdAt: petition.createdAt,
      event: petition.event,
      message: petition.message,
      sender: petition.sender,
      state: petition.state,
      team: petition.team,
      type: petition.type,
      user: petition.user
    }
  );
  return res.status(201).json(dataResponse);
};
