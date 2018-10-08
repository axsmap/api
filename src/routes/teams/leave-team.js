const moment = require('moment');

const { Team } = require('../../models/team');

module.exports = async (req, res, next) => {
  const teamId = req.params.teamId;

  let team;
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' });
    }

    console.log(`Team ${teamId} failed to be found at leave-team`);
    return next(err);
  }

  if (!team) {
    return res.status(404).json({ general: 'Team not found' });
  }

  if (team.managers.find(m => m.toString() === req.user.id)) {
    team.managers = team.managers.filter(m => m.toString() !== req.user.id);

    if (team.managers.length === 0) {
      return res.status(400).json({
        general: 'You cannot leave because you are the only manager'
      });
    }
  } else if (team.members.find(m => m.toString() === req.user.id)) {
    team.members = team.members.filter(m => m.toString() !== req.user.id);
  } else {
    return res.status(400).json({ general: 'You are not a member' });
  }

  const today = moment.utc();
  team.updatedAt = today.toDate();

  try {
    await team.save();
  } catch (err) {
    console.log(`Team ${team.id} failed to be updated at leave-team`);
    return next(err);
  }

  req.user.teams = req.user.teams.filter(t => t.toString() !== team.id);
  req.user.updatedAt = today.toDate();

  try {
    await req.user.save();
  } catch (err) {
    console.log(`User ${req.user.id} failed to be updated at leave-team`);
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
