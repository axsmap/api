const crypto = require("crypto");

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const moment = require("moment");

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
      code = googleToken?.id_token;
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: code,
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
          `User ${user._id} failed to update lastSignIn at google-sign-in: ${err.message}`
        );
      });
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
