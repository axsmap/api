const crypto = require("crypto");

const axios = require("axios");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

module.exports = async (req, res) => {
  let token = req?.body?.code;
  try {
    if (req.body.web) {
      const tokenResponse = await axios.get(
        "https://graph.facebook.com/v17.0/oauth/access_token",
        {
          params: {
            client_id: process.env.FACEBOOK_CLIENT_ID,
            client_secret: process.env.FACEBOOK_CLIENT_SECRET,
            redirect_uri: req.body.redirectUri, // must match exactly
            code: req.body.code,
          },
        }
      );

      token = tokenResponse.data.access_token;
    }

    let fbUser = req.body?.profile || {};
    if (!req.body?.profile) {
      const fbUserResponse = await axios.get(`https://graph.facebook.com/me`, {
        params: {
          access_token: token,
          fields: "id,name,email,picture",
        },
      });

      fbUser = fbUserResponse.data;
    }
    if (fbUser?.email) {
      const email = fbUser.email;

      let user = await User.findOne({ email: fbUser.email });

      if (!user) {
        const [firstName, lastName] = fbUser.name.split(" ");
        user = new User({
          fbId: fbUser.id,
          email,
          firstName: firstName || "",
          lastName: lastName || "",
          avatar: fbUser.picture.data.url,
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
            `User ${user._id} failed to update lastSignIn at facebook-sign-in: ${err.message}`
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
    } else {
      res.status(400).json({
        success: false,
        error: "Email is not linked with this account",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(401).json({ success: false, error: "Invalid Facebook token" });
  }
};
