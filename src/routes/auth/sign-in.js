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

  let user;
  try {
    user = await User.findOne({ email, isArchived: false });
    console.log("User", user);
  } catch (err) {
    console.log(`User with email ${email} failed to be found at sign-in.`);
    return next(err);
  }

  if (!user) {
    return res.status(400).json({ general: "Email or password incorrect" });
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

  // Update last_sign_in timestamp and reset notification tracking
  // (Non-blocking: if save fails, sign-in still proceeds)
  user.lastSignIn = new Date();
  user.notificationType = null;

  // Link any device installations to this user
  const deviceId = req.headers["x-device-id"];
  if (deviceId) {
    const { DeviceInstallation } = require("../../models/device-installation");
    DeviceInstallation.updateMany(
      { deviceId, userId: null },
      { userId: user._id }
    ).catch((err) => {
      console.log(
        `Failed to link device ${deviceId} to user ${user.id}: ${err.message}`
      );
    });
  }

  user.save().catch((err) => {
    console.log(
      `User ${user.id} failed to update lastSignIn at sign-in: ${err.message}`
    );
  });

  const userId = user.id;
  const today = moment.utc();
  const expiresAt = today.add(30, "days").toDate();
  const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );
  } catch (err) {
    console.log(
      `Refresh Token for userId ${userId} failed to be created or updated at sign-in.`
    );
    return next(err);
  }
  console.log(process.env.JWT_SECRET);
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  return res.status(200).json({ refreshToken: refreshToken.key, token });
};
