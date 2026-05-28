const crypto = require('crypto');

const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const moment = require('moment');

const { RefreshToken } = require('../../models/refresh-token');

const { markUserOpened } = require('../../helpers/user-activity');
const { getDb } = require('../events/leaderboard-helpers');
const { validateSignIn } = require('./validations');

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;
  const password = req.body.password;

  let user;
  try {
    const db = await getDb();
    user = await db.collection('users').findOne({ email, isArchived: false });
  } catch (err) {
    console.log(`User with email ${email} failed to be found at sign-in.`);
    return next(err);
  }

  if (!user) {
    return res.status(400).json({ general: 'Email or password incorrect' });
  }

  if (user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' });
  }

  if (!user.hashedPassword) {
    return res.status(400).json({ general: 'Email or password incorrect' });
  }

  const passwordMatches = bcrypt.compareSync(password, user.hashedPassword);

  if (!passwordMatches) {
    return res.status(400).json({ general: 'Email or password incorrect' });
  }

  const userId = user._id.toString();
  const today = moment.utc();
  const expiresAt = today.add(14, 'days').toDate();
  const key = `${userId}${crypto.randomBytes(28).toString('hex')}`;

  let refreshToken;
  try {
    const db = await getDb();
    refreshToken = await db
      .collection(RefreshToken.collection.name)
      .findOneAndUpdate(
        { userId },
        {
          $set: { expiresAt, key, userId, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        { returnDocument: 'after', upsert: true }
      );
  } catch (err) {
    console.log(
      `Refresh Token for userId ${userId} failed to be created or updated at sign-in.`
    );
    return next(err);
  }

  try {
    await markUserOpened(userId);
  } catch (err) {
    console.log(`User ${userId} failed to mark opened at sign-in.`);
    return next(err);
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: 36000
  });
  return res.status(200).json({ refreshToken: refreshToken.key, token });
};
