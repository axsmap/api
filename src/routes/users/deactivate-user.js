const moment = require('moment');

const { ActivationTicket } = require('../../models/activation-ticket');
const { PasswordTicket } = require('../../models/password-ticket');
const { RefreshToken } = require('../../models/refresh-token');
const { User } = require('../../models/user');

module.exports = async (req, res, next) => {
  const userId = req.user._id;

  let user;
  try {
    user = await User.findOne({ _id: userId, isArchived: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'User not found' });
    }

    console.log(`User with Id ${userId} failed to be found at archive-user.`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' });
  }

  let activateAccountTicket;
  let passwordTicket;
  let refreshToken;
  try {
    [activateAccountTicket, passwordTicket, refreshToken] = await Promise.all([
      ActivationTicket.findOne({ email: user.email }),
      PasswordTicket.findOne({ email: user.email }),
      RefreshToken.findOne({ userId: user.id })
    ]);
  } catch (err) {
    console.log(
      `Activate account ticket, password ticket or refresh token with email ${
        user.email
      } failed to be found at archive-user.`
    );
    return next(err);
  }

  if (activateAccountTicket) {
    try {
      await activateAccountTicket.remove();
    } catch (err) {
      console.log(
        `Activate user ticket with key ${
          activateAccountTicket.key
        } failed to be removed at archive-user.`
      );
      return next(err);
    }
  }

  if (passwordTicket) {
    try {
      await passwordTicket.remove();
    } catch (err) {
      console.log(
        `Password ticket with key ${
          passwordTicket.key
        } failed to be removed at archive-user.`
      );
      return next(err);
    }
  }

  if (refreshToken) {
    try {
      await refreshToken.remove();
    } catch (err) {
      console.log(
        `Refresh token with key ${
          refreshToken.key
        } failed to be removed at archive-user.`
      );
      return next(err);
    }
  }

  user.isArchived = true;
  user.updatedAt = moment.utc().toDate();

  try {
    await user.save();
  } catch (err) {
    console.log(
      `User with email ${user.email} failed to be updated at archive-user.`
    );
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
