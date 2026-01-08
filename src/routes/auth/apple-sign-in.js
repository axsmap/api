const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateAppleSignIn } = require("./validations");

const appleSignin = require("apple-signin-auth");

module.exports = async (req, res) => {
  const { errors, isValid } = validateAppleSignIn(req.body);
  const { identityToken } = req.body;
  if (!isValid) {
    return res.status(400).json(errors);
  }

  try {
    const appleResponse = await appleSignin.verifyIdToken(identityToken, {
      audience: process?.env?.APPLE_APP_IDENTIFIER, // Your app's Bundle ID or Service ID
      ignoreExpiration: false, // Set true only for testing (not recommended in production)
    });
    console.log(appleResponse);
    let user = await User.findOne({
      email: appleResponse?.email,
    });
    if (!user) {
      user = new User({
        email: appleResponse?.email,
        firstName: appleResponse?.fullName?.givenName ?? "",
        lastName: appleResponse?.fullName?.familyName ?? "",
        appleId: appleResponse?.sub,
        lastSignIn: new Date(),
      });

      await user.save();
    } else {
      // Update last_sign_in timestamp and reset notification tracking
      // (Non-blocking: if save fails, sign-in still proceeds)
      user.lastSignIn = new Date();
      user.notificationType = null;

      // Link any device installations to this user
      const deviceId = req.headers["x-device-id"];
      if (deviceId) {
        const {
          DeviceInstallation,
        } = require("../../models/device-installation");
        DeviceInstallation.updateMany(
          { deviceId, userId: null },
          { userId: user._id }
        ).catch((err) => {
          console.log(
            `Failed to link device ${deviceId} to user ${user._id}: ${err.message}`
          );
        });
      }

      user.save().catch((err) => {
        console.log(
          `User ${user._id} failed to update lastSignIn at apple-sign-in: ${err.message}`
        );
      });
    }
    const userId = user._id;
    const today = moment.utc();
    const expiresAt = today.add(30, "days").toDate();
    const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;
    let refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    res.json({
      refreshToken: refreshToken.key,
      token,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(401)
      .json({ success: false, error: "Invalid Apple token" });
  }
};
