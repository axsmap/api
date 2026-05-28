const jwt = require('jsonwebtoken');
const moment = require('moment');

const { RefreshToken } = require('../../models/refresh-token');

const { markUserOpened } = require('../../helpers/user-activity');
const { validateGenerateToken } = require('./validations');

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateGenerateToken(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const key = req.body.key;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOne({ key });
  } catch (err) {
    console.log(
      `Refresh Token with key ${key} failed to be found at generate-token.`
    );
    return next(err);
  }

  if (!refreshToken) {
    return res.status(404).json({ general: 'Refresh Token not found' });
  }

  const expiresAt = moment(refreshToken.expiresAt).utc();
  const today = moment.utc();
  if (expiresAt.isBefore(today)) {
    try {
      await refreshToken.remove();
    } catch (err) {
      console.log(
        `Refresh Token with key ${
          refreshToken.key
        } failed to be removed at generate-token.`
      );
      return next(err);
    }

    return res.status(401).json({ general: 'Refresh Token expired' });
  }

  try {
    await markUserOpened(refreshToken.userId);
  } catch (err) {
    console.log(
      `User ${refreshToken.userId} failed to mark opened at generate-token.`
    );
    return next(err);
  }

  const token = jwt.sign(
    { userId: refreshToken.userId },
    process.env.JWT_SECRET,
    {
      expiresIn: 3600
    }
  );
  return res.status(200).json({ token });
};
