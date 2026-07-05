const crypto = require("crypto");

const axios = require("axios");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");
const { buildDisplayName } = require("../../helpers");

const { validateAppleSignIn } = require("./validations");

const appleSignin = require("apple-signin-auth");

module.exports = async (req, res, next) => {
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
    const now = new Date();
    if (!user) {
      const appleFirst = appleResponse?.fullName?.givenName ?? "";
      const appleLast = appleResponse?.fullName?.familyName ?? "";
      user = new User({
        email: appleResponse?.email,
        firstName: appleFirst,
        lastName: appleLast,
        displayName: buildDisplayName(appleFirst, appleLast),
        promptedForVisibility: true,
        appleId: appleResponse?.sub,
        lastLogin: now,
        lastOpenedAt: now,
      });

      await user.save();
      console.log(`[app-open] apple-sign-in (new): userId=${user._id} lastOpenedAt=${now.toISOString()}`);
    } else {
      // Check if user is archived
      if (user.isArchived) {
        return res.status(403).json({
          error: "Account archived",
          isArchived: true,
          userId: user._id.toString()
        });
      }

      // Real app-open: update lastLogin AND lastOpenedAt for existing users
      await User.findByIdAndUpdate(user._id, { lastLogin: now, lastOpenedAt: now });
      console.log(`[app-open] apple-sign-in (existing): userId=${user._id} lastOpenedAt=${now.toISOString()}`);
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
    console.log(err)
    res.status(401).json({ success: false, error: "Invalid Apple token" });
  }
};
