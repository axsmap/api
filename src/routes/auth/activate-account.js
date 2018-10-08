const crypto = require('crypto');

const moment = require('moment');
const randomstring = require('randomstring');
const slugify = require('speakingurl');

const { ActivationTicket } = require('../../models/activation-ticket');
const { RefreshToken } = require('../../models/refresh-token');
const { User } = require('../../models/user');

module.exports = async (req, res, next) => {
  const key = req.params.key;

  let activationTicket;
  try {
    activationTicket = await ActivationTicket.findOne({ key });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Activation ticket not found' });
    }

    console.log(
      `Activation ticket with key ${key} failed to be found at activate-account.`
    );
    return next(err);
  }

  if (!activationTicket) {
    return res.status(404).json({ general: 'Activation ticket not found' });
  }

  let expiresAt = moment(activationTicket.expiresAt).utc();
  const now = moment.utc();
  if (expiresAt.isBefore(now)) {
    try {
      await activationTicket.remove();
    } catch (err) {
      console.log(
        `Activation ticket with key ${
          activationTicket.key
        } failed to be deleted at activate-account.`
      );
      return next(err);
    }

    return res.status(400).json({ general: 'Activation ticket expired' });
  }

  const userData = Object.assign({}, activationTicket.userData, {
    email: activationTicket.email
  });

  let repeatedUsers;
  try {
    repeatedUsers = await User.find({
      $or: [{ email: userData.email }, { username: userData.username }],
      isArchived: false
    });
  } catch (err) {
    console.log('Users failed to be found at activate-account.');
    return next(err);
  }

  if (repeatedUsers && repeatedUsers.length > 0) {
    for (const user of repeatedUsers) {
      if (user.email === userData.email) {
        return res.status(400).json({ email: 'Is already taken' });
      }

      let repeatedUser;
      do {
        userData.username = `${slugify(userData.firstName)}-${slugify(
          userData.lastName
        )}-${randomstring.generate({
          length: 5,
          capitalization: 'lowercase'
        })}`;

        try {
          repeatedUser = await User.findOne({
            username: userData.username,
            isArchived: false
          });
        } catch (err) {
          console.log(
            `User with username ${
              userData.username
            } failed to be found at activate-account.`
          );
          return next(err);
        }
      } while (repeatedUser && repeatedUser.username === userData.username);
    }
  }

  let user;
  try {
    user = await User.create(userData);
  } catch (err) {
    console.log(
      `User failed to be created at activate-account.\nData: ${JSON.stringify(
        userData
      )}`
    );
    return next(err);
  }

  const today = moment.utc();
  expiresAt = today.add(14, 'days').toDate();
  const refreshTokenData = {
    expiresAt,
    key: `${user.id}${crypto.randomBytes(28).toString('hex')}`,
    userId: user.id
  };

  try {
    await RefreshToken.create(refreshTokenData);
  } catch (err) {
    console.log(
      `Refresh token failed to be created at activate-account.\nData: ${JSON.stringify(
        refreshTokenData
      )}`
    );
    return next(err);
  }

  try {
    await activationTicket.remove();
  } catch (err) {
    console.log(
      `Activation ticket with key ${
        activationTicket.key
      } failed to be deleted at activate-account.`
    );
    return next(err);
  }

  return res.redirect(`${process.env.APP_URL}/sign-in`);
};
