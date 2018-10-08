const { difference, intersection } = require('lodash');
const moment = require('moment');

const { cleanSpaces } = require('../../helpers');
const { Photo } = require('../../models/photo');
const { Team } = require('../../models/team');
const { User } = require('../../models/user');

const { validateEditTeam } = require('./validations');

module.exports = async (req, res, next) => {
  const teamId = req.params.teamId;

  let team;
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' });
    }

    console.log(`Team ${teamId} failed to be found at edit-team`);
    return next(err);
  }

  if (!team) {
    return res.status(404).json({ general: 'Team not found' });
  }

  if (
    !team.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  const data = {
    avatar: req.body.avatar,
    description: req.body.description,
    managers: req.body.managers,
    members: req.body.members,
    name: req.body.name
  };
  const { errors, isValid } = validateEditTeam(data);
  if (!isValid) return res.status(400).json(errors);

  if (
    data.avatar &&
    !data.avatar.includes('default') &&
    data.avatar !== team.avatar
  ) {
    let avatar;
    try {
      avatar = await Photo.findOne({ url: data.avatar });
    } catch (err) {
      console.log(`Avatar ${data.avatar} failed to be found at edit-team`);
      return next(err);
    }

    if (!avatar) {
      return res.status(404).json({ avatar: 'Not found' });
    }

    team.avatar = data.avatar;
  } else if (data.avatar === '') {
    team.avatar = `https://s3.amazonaws.com/${
      process.env.AWS_S3_BUCKET
    }/teams/avatars/default.png`;
  }

  team.description = data.description || team.description;

  if (data.managers) {
    let managersToAdd = [];
    let managersToRemove = [];

    data.managers.forEach(m => {
      if (m.startsWith('-')) {
        managersToRemove = [...managersToRemove, m.substring(1)];
      } else {
        managersToAdd = [...managersToAdd, m];
      }
    });

    const teamManagers = team.managers.map(m => m.toString());

    managersToAdd = [...new Set(difference(managersToAdd, teamManagers))];
    if (managersToAdd.length > 0) {
      const teamMembers = team.members.map(m => m.toString());
      const notMember = managersToAdd.find(m => !teamMembers.includes(m));

      if (notMember) {
        return res
          .status(400)
          .json({ managers: `User ${notMember} is not a member of this team` });
      }

      team.managers = [...teamManagers, ...managersToAdd];
      team.members = team.members.filter(
        m => !managersToAdd.includes(m.toString())
      );
    }

    managersToRemove = [
      ...new Set(intersection(managersToRemove, teamManagers))
    ];
    if (managersToRemove.length === team.managers.length) {
      return res
        .status(400)
        .json({ managers: 'Should not remove all managers' });
    }

    team.managers = team.managers.filter(
      m => !managersToRemove.includes(m.toString())
    );
    const teamMembers = team.members.map(m => m.toString());
    team.members = [...teamMembers, ...managersToRemove];
  }

  if (data.members) {
    const teamMembers = team.members.map(m => m.toString());
    let membersToRemove = data.members.map(m => m.substring(1));
    membersToRemove = [...new Set(intersection(membersToRemove, teamMembers))];

    const getMembers = membersToRemove.map(m =>
      User.find({ _id: m, isArchived: false })
    );
    let members;
    try {
      members = await Promise.all(getMembers);
    } catch (err) {
      console.log(`Members failed to be found at edit-team`);
      return next(err);
    }

    const updateMembers = members.map((m, i) => {
      m[i].teams = m[i].teams.filter(t => t.toString() !== team.id);
      return m[i].save();
    });

    try {
      await Promise.all(updateMembers);
    } catch (err) {
      console.log(`Members failed to be updated at edit-team`);
      return next(err);
    }

    team.members = team.members.filter(
      m => !membersToRemove.includes(m.toString())
    );
  }

  if (data.name) {
    const teamName = cleanSpaces(data.name);

    if (teamName !== team.name) {
      let repeatedTeam;
      try {
        repeatedTeam = await Team.findOne({
          name: teamName,
          isArchived: false
        });
      } catch (err) {
        console.log(`Team ${teamName} failed to be found at edit-team`);
        return next(err);
      }

      if (repeatedTeam) {
        return res.status(400).json({ name: 'Is already taken' });
      }

      team.name = teamName;
    }
  }

  team.updatedAt = moment.utc().toDate();

  try {
    await team.save();
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(`Team ${team.id} failed to be updated at edit-team`);
    return next(err);
  }

  const dataResponse = {
    id: team.id,
    avatar: team.avatar,
    description: team.description,
    managers: team.managers,
    members: team.members,
    name: team.name
  };

  return res.status(200).json(dataResponse);
};
