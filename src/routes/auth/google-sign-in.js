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
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

module.exports = async (req, res) => {
  const { errors, isValid } = validateGoogleSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const code = req.body.code;
  const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    const [firstName, lastName] = name.split(" ");

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email: email,
        firstName: firstName || name,
        lastName: lastName || "",
        createdAt: new Date(),
      });
      await user.save();
    }
    const key = `${user._id}${crypto.randomBytes(28).toString("hex")}`;

    const refreshToken = randomstring.generate(80);
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    const expiryDate = moment().add(30, "days").toDate();

    await RefreshToken.create({
      userId: user._id,
      key,
      token: token,
      expiresAt: expiryDate,
    });

    return res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid ID token" });
  }
};
