const moment = require('moment');

const { PasswordTicket } = require('../../models/password-ticket');
const { RefreshToken } = require('../../models/refresh-token');
const { User } = require('../../models/user');

const { validateResetPassword } = require('./validations');

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateResetPassword(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const key = req.body.key;
  const password = req.body.password;

  let passwordTicket;
  try {
    passwordTicket = await PasswordTicket.findOne({ key });
  } catch (err) {
    console.log(
      `Password ticket with key ${key} failed to be found at reset-password.`
    );
    return next(err);
  }

  if (!passwordTicket) {
    return res.status(404).json({ general: 'Password Ticket not found' });
  }

  const expiresAt = moment(passwordTicket.expiresAt).utc();
  const today = moment.utc();
  if (expiresAt.isBefore(today)) {
    try {
      await passwordTicket.remove();
    } catch (err) {
      console.log(
        `Password Ticket with key ${
          passwordTicket.key
        } failed to be removed at reset-password.`
      );
      return next(err);
    }

    return res.status(400).json({ general: 'Password Ticket expired' });
  }

  let user;
  try {
    user = await User.findOne({
      email: passwordTicket.email,
      isArchived: false
    });
  } catch (err) {
    console.log(
      `User with email ${
        passwordTicket.email
      } failed to be found at reset-password.`
    );
    return next(err);
  }

  if (!user) {
    try {
      await passwordTicket.remove();
    } catch (err) {
      console.log(
        `Password Ticket with key ${
          passwordTicket.key
        } failed to be removed at reset-password.`
      );
      return next(err);
    }

    return res.status(400).json({ general: 'User not found' });
  }

  const passwordMatches = user.comparePassword(password);
  if (passwordMatches) {
    return res.status(400).json({ password: 'Is already used' });
  }

  user.password = password;
  user.updatedAt = moment.utc().toDate();

  try {
    await user.save();
  } catch (err) {
    console.log(
      `User with email ${user.email} failed to be updated at reset-password.`
    );
    return next(err);
  }

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOne({ userId: user.id });
  } catch (err) {
    console.log(
      `Refresh token with userId ${
        user.id
      } failed to be found at reset-password.`
    );
    return next(err);
  }

  if (refreshToken) {
    try {
      await refreshToken.remove();
    } catch (err) {
      console.log(
        `Refresh Token with userId ${
          refreshToken.userId
        } failed to be removed at reset-password.`
      );
      return next(err);
    }
  }

  try {
    await passwordTicket.remove();
  } catch (err) {
    console.log(
      `Password Ticket with key ${
        passwordTicket.key
      } failed to be removed at reset-password.`
    );
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
