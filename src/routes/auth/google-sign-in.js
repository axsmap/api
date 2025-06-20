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

  let token = req.body.code;
  const oauth2Client = new OAuth2Client(CLIENT_ID);
  try {
    const deviceType = req.headers["x-device-type"];
    if (deviceType === "web") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: token,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      token = await tokenRes.json();
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    const [firstName, lastName] = name.split(" ");

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email: email,
        firstName: firstName || name,
        lastName: lastName || "",
        createdAt: new Date(),
        avatar: picture,
      });
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    const userId = user._id;
    const today = moment.utc();
    const expiresAt = today.add(30, "days").toDate();
    const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;

    let refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId },
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
