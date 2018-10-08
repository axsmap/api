const { cleanSpaces } = require('../../helpers');
const { Photo } = require('../../models/photo');
const { Team } = require('../../models/team');

const { validateCreateTeam } = require('./validations');

module.exports = async (req, res, next) => {
  const data = {
    avatar: req.body.avatar,
    description: req.body.description,
    name: req.body.name
  };

  const { errors, isValid } = validateCreateTeam(data);
  if (!isValid) return res.status(400).json(errors);

  if (data.avatar) {
    let avatar;
    try {
      avatar = await Photo.findOne({ url: data.avatar });
    } catch (err) {
      console.log(`Avatar ${data.avatar} failed to be found at create-team`);
      return next(err);
    }

    if (!avatar) {
      return res.status(404).json({ avatar: 'Not found' });
    }
  }

  data.managers = [req.user.id];

  data.name = cleanSpaces(data.name);

  let repeatedTeam;
  try {
    repeatedTeam = await Team.findOne({ name: data.name, isArchived: false });
  } catch (err) {
    console.log(`Team ${data.name} failed to be found at create-team`);
    return next(err);
  }

  if (repeatedTeam) {
    return res.status(400).json({ name: 'Is already taken' });
  }

  let team;
  try {
    team = await Team.create(data);
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {};

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(
      `Team ${
        data.name
      } failed to be created at create-team.\nData: ${JSON.stringify(data)}`
    );
    return next(err);
  }

  req.user.teams = [...req.user.teams, team.id];

  try {
    await req.user.save();
  } catch (err) {
    console.log(`User ${req.user.id} failed to be updated at create-team`);
    return next(err);
  }

  const dataResponse = {
    id: team.id,
    avatar: team.avatar,
    description: team.description,
    managers: [
      {
        id: req.user.id,
        avatar: req.user.avatar,
        name: `${req.user.firstName} ${req.user.lastName}`
      }
    ],
    name: team.name
  };

  return res.status(201).json(dataResponse);
};
