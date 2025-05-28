const crypto = require("crypto");

const axios = require("axios");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

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
    if (!user) {
      user = new User({
        email: appleResponse?.email,
        firstName:appleResponse?.fullName?.givenName ?? "",
        lastName:appleResponse?.fullName?.familyName ?? "",
        appleId: appleResponse?.sub,
      });

      await user.save();
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
