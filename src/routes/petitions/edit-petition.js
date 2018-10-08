const moment = require('moment');

const { Event } = require('../../models/event');
const { Petition } = require('../../models/petition');
const { Team } = require('../../models/team');
const { User } = require('../../models/user');

const { validateEditPetition } = require('./validations');

module.exports = async (req, res, next) => {
  const petitionId = req.params.petitionId;

  let petition;
  try {
    petition = await Petition.findOne({ _id: petitionId });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Petition not found' });
    }

    console.log(`Petition ${petitionId} failed to be found at edit-petition`);
    return next(err);
  }

  if (!petition) {
    return res.status(404).json({ general: 'Petition not found' });
  }

  if (petition.state === 'accepted') {
    return res.status(400).json({ general: 'Is already accepted' });
  }

  if (petition.state === 'canceled') {
    return res.status(400).json({ general: 'Is already canceled' });
  }

  if (petition.state === 'rejected') {
    return res.status(400).json({ general: 'Is already rejected' });
  }

  const { errors, isValid } = validateEditPetition(req.body);
  if (!isValid) return res.status(400).json(errors);

  let isSender = false;

  if (petition.sender.toString() === req.user.id) {
    isSender = true;
    if (req.body.state === 'canceled') {
      petition.state = 'canceled';
    } else {
      return res.status(400).json({ state: 'Should only be canceled' });
    }
  }

  if (petition.type.endsWith('event')) {
    let event;
    try {
      event = await Event.findOne({ _id: petition.event });
    } catch (err) {
      console.log(
        `Event ${petition.event} failed to be found at edit-petition`
      );
      return next(err);
    }

    if (!event) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at edit-petition`
        );
        return next(err);
      }

      return res.status(400).json({
        general: 'Event is already removed. Petition was removed'
      });
    }

    if (petition.type === 'invite-team-event') {
      let team;
      try {
        team = await Team.findOne({ _id: petition.team });
      } catch (err) {
        console.log(
          `Team ${petition.team} failed to be found at edit-petition`
        );
        return next(err);
      }

      if (!team) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general: 'Team is already removed. Petition was removed'
        });
      }

      if (event.teams.find(t => t.toString() === team.id)) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general:
            'Team is already a participant of event. Petition was removed'
        });
      }

      if (isSender) {
        if (!event.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }
      } else {
        if (!team.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }

        if (req.body.state === 'accepted') {
          event.teams = [...event.teams, team.id];
          event.updatedAt = moment.utc().toDate();

          try {
            await event.save();
          } catch (err) {
            console.log(
              `Event ${event.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          team.events = [...team.events, event.id];
          team.updatedAt = moment.utc().toDate();

          try {
            await team.save();
          } catch (err) {
            console.log(
              `Team ${team.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          petition.state = 'accepted';
        } else {
          petition.state = 'rejected';
        }
      }
    } else if (petition.type === 'invite-user-event') {
      if (
        event.participants.find(p => p.toString() === petition.user.toString())
      ) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general:
            'User is already a participant of event. Petition was removed'
        });
      }

      if (isSender) {
        if (!event.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }
      } else {
        if (petition.user.toString() !== req.user.id) {
          return res.status(403).json({ general: 'Forbidden action' });
        }

        if (req.body.state === 'accepted') {
          event.participants = [...event.participants, req.user.id];
          event.updatedAt = moment.utc().toDate();

          try {
            await event.save();
          } catch (err) {
            console.log(
              `Event ${event.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          req.user.events = [...req.user.events, event.id];
          req.user.updatedAt = moment.utc().toDate();

          try {
            await req.user.save();
          } catch (err) {
            console.log(
              `User ${req.user.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          petition.state = 'accepted';
        } else {
          petition.state = 'rejected';
        }
      }
    } else if (petition.type === 'request-team-event') {
      let team;
      try {
        team = await Team.findOne({ _id: petition.team });
      } catch (err) {
        console.log(
          `Team ${petition.team} failed to be found at edit-petition`
        );
        return next(err);
      }

      if (!team) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general: 'Team is already removed. Petition was removed'
        });
      }

      if (event.teams.find(t => t.toString() === team.id)) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general:
            'Team is already a participant of event. Petition was removed'
        });
      }

      if (isSender) {
        if (!team.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }
      } else {
        if (!event.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }

        if (req.body.state === 'accepted') {
          event.teams = [...event.teams, team.id];
          event.updatedAt = moment.utc().toDate();

          try {
            await event.save();
          } catch (err) {
            console.log(
              `Event ${event.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          team.events = [...team.events, event.id];
          team.updatedAt = moment.utc().toDate();

          try {
            await team.save();
          } catch (err) {
            console.log(
              `Team ${team.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          petition.state = 'accepted';
        } else {
          petition.state = 'rejected';
        }
      }
    } else {
      // petition.type === 'request-user-event'
      let user;
      try {
        user = await User.findOne({ _id: petition.sender });
      } catch (err) {
        console.log(
          `User ${petition.user} failed to be found at edit-petition`
        );
        return next(err);
      }

      if (!user) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general: 'User is already removed. Petition was removed'
        });
      }

      if (event.participants.find(p => p.toString() === user.id)) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general:
            'User is already a participant of event. Petition was removed'
        });
      }

      if (!isSender) {
        if (!event.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }

        if (req.body.state === 'accepted') {
          event.participants = [...event.participants, user.id];
          event.updatedAt = moment.utc().toDate();

          try {
            await event.save();
          } catch (err) {
            console.log(
              `Event ${event.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          user.events = [...user.events, event.id];
          user.updatedAt = moment.utc().toDate();

          try {
            await user.save();
          } catch (err) {
            console.log(
              `User ${user.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          petition.state = 'accepted';
        } else {
          petition.state = 'rejected';
        }
      }
    }
  } else {
    // petition.type.endsWith('team')
    let team;
    try {
      team = await Team.findOne({ _id: petition.team });
    } catch (err) {
      console.log(
        `Team ${petition.entityId} failed to be found at edit-petition`
      );
      return next(err);
    }

    if (!team) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at edit-petition`
        );
        return next(err);
      }

      return res.status(400).json({
        general: 'Team is already removed. Petition was removed'
      });
    }

    if (petition.type === 'invite-user-team') {
      if (team.members.find(m => m.toString() === petition.user.toString())) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general: 'User is already a member of team. Petition was removed'
        });
      }

      if (isSender) {
        if (!team.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }
      } else {
        if (petition.user.toString() !== req.user.id) {
          return res.status(403).json({ general: 'Forbidden action' });
        }

        if (req.body.state === 'accepted') {
          team.members = [...team.members, req.user.id];
          team.updatedAt = moment.utc().toDate();

          try {
            await team.save();
          } catch (err) {
            console.log(
              `Team ${team.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          req.user.teams = [...req.user.teams, team.id];
          req.user.updatedAt = moment.utc().toDate();

          try {
            await req.user.save();
          } catch (err) {
            console.log(
              `User ${req.user.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          petition.state = 'accepted';
        } else {
          petition.state = 'rejected';
        }
      }
    } else {
      // petition.type === 'request-user-team'

      let user;
      try {
        user = await User.findOne({ _id: petition.sender });
      } catch (err) {
        console.log(
          `User ${petition.senderId} failed to be found at edit-petition`
        );
        return next(err);
      }

      if (!user) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general: 'User is already removed. Petition was removed'
        });
      }

      if (team.members.find(m => m.toString() === user.id)) {
        try {
          await petition.remove();
        } catch (err) {
          console.log(
            `Petition ${petition.id} failed to be removed at edit-petition`
          );
          return next(err);
        }

        return res.status(400).json({
          general: 'User is already a member of team. Petition was removed'
        });
      }

      if (!isSender) {
        if (!team.managers.find(m => m.toString() === req.user.id)) {
          return res.status(403).json({ general: 'Forbidden action' });
        }

        if (req.body.state === 'accepted') {
          team.members = [...team.members, user.id];
          team.updatedAt = moment.utc().toDate();

          try {
            await team.save();
          } catch (err) {
            console.log(
              `Team ${team.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          user.teams = [...user.teams, team.id];
          user.updatedAt = moment.utc().toDate();

          try {
            await user.save();
          } catch (err) {
            console.log(
              `User ${user.id} failed to be updated at edit-petition`
            );
            return next(err);
          }

          petition.state = 'accepted';
        } else {
          petition.state = 'rejected';
        }
      }
    }
  }

  petition.updatedAt = moment.utc().toDate();

  try {
    await petition.save();
  } catch (err) {
    console.log(
      `Petition ${petition.id} failed to be updated at edit-petition`
    );
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
