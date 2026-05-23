const crypto = require("crypto");
const querystring = require("querystring");

const axios = require("axios");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const randomstring = require("randomstring");
const slugify = require("speakingurl");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateGoogleSignIn } = require("./validations");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

module.exports = async (req, res) => {
  const { errors, isValid } = validateGoogleSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  let code = req.body.code;
  const rememberMe = req.body.rememberMe || false;
  const oauth2Client = new OAuth2Client(CLIENT_ID);
  try {
    const deviceType = req.headers["x-device-type"];
    if (deviceType === "web") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const googleToken = await tokenRes.json();
      code =googleToken?.id_token
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: code,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    const [firstName, lastName] = name.split(" ");

    let user = await User.findOne({ email });
    const now = new Date();
    if (!user) {
      user = new User({
        email: email,
        firstName: firstName || name,
        lastName: lastName || "",
        createdAt: now,
        avatar: picture,
        lastLogin: now,
        lastOpenedAt: now,
      });
      await user.save();
      console.log(`[app-open] google-sign-in (new): userId=${user._id} lastOpenedAt=${now.toISOString()}`);
    } else {
      // Check if user is archived - return userId for reactivation flow
      // For social login users, they'll need to contact support since they don't have a password
      if (user.isArchived) {
        return res.status(403).json({
          general: "Account is archived due to inactivity",
          isArchived: true,
          requiresReactivation: true,
          userId: user.id
        });
      }

      // Real app-open: update lastLogin, lastOpenedAt, and reset inactivity tracking
      await User.findByIdAndUpdate(user._id, {
        lastLogin: now,
        lastOpenedAt: now,
        inactivityEmailSent: false,
        inactivityEmailSentAt: null
      });
      console.log(`[app-open] google-sign-in (existing): userId=${user._id} lastOpenedAt=${now.toISOString()}`);
    }

    // Set token expiration based on rememberMe
    // If rememberMe is true: 90 days, otherwise: 7 days
    const tokenExpirationDays = rememberMe ? 90 : 7;
    const jwtExpiration = rememberMe ? '90d' : '7d';

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: jwtExpiration,
    });

    const userId = user._id;
    const today = moment.utc();
    const expiresAt = today.add(tokenExpirationDays, "days").toDate();
    const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;

    let refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId, rememberMe },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );

    return res.json({
      token,
      refreshToken: refreshToken.key,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};
