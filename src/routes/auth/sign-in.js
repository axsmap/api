const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateSignIn } = require("./validations");

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;
  const password = req.body.password;
  const rememberMe = req.body.rememberMe || false;

  let user;
  try {
    // First check if user exists (including archived users)
    user = await User.findOne({ email });
  } catch (err) {
    console.log(`User with email ${email} failed to be found at sign-in.`);
    return next(err);
  }

  if (!user) {
    return res.status(400).json({ general: "Email or password incorrect" });
  }

  // Check if user is archived - redirect to reactivation
  if (user.isArchived) {
    return res.status(403).json({ 
      general: "Account is archived due to inactivity",
      isArchived: true,
      requiresReactivation: true
    });
  }

  if (user.isBlocked) {
    return res.status(423).json({ general: "You are blocked" });
  }

  if (!user.hashedPassword) {
    return res.status(400).json({ general: "Email or password incorrect" });
  }

  const passwordMatches = user.comparePassword(password);

  if (!passwordMatches) {
    return res.status(400).json({ general: "Email or password incorrect" });
  }

  const userId = user.id;

  // Update lastLogin timestamp and reset inactivity tracking
  try {
    await User.findByIdAndUpdate(userId, { 
      lastLogin: new Date(),
      inactivityEmailSent: false,
      inactivityEmailSentAt: null
    });
  } catch (updateErr) {
    console.log(`Failed to update lastLogin for userId ${userId}: ${updateErr.message}`);
    // Continue with login even if lastLogin update fails
  }

  // Set token expiration based on rememberMe
  // If rememberMe is true: 90 days, otherwise: 7 days (short-lived session)
  const tokenExpirationDays = rememberMe ? 90 : 7;
  const jwtExpiration = rememberMe ? '90d' : '7d';

  const today = moment.utc();
  const expiresAt = today.add(tokenExpirationDays, "days").toDate();
  const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId, rememberMe },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );
  } catch (err) {
    console.log(
      `Refresh Token for userId ${userId} failed to be created or updated at sign-in.`
    );
    return next(err);
  }
console.log(process.env.JWT_SECRET)
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: jwtExpiration,
  });
  return res.status(200).json({ refreshToken: refreshToken.key, token });
};
