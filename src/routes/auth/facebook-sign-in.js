const crypto = require("crypto");

const axios = require("axios");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateFacebookSignIn } = require("./validations");

module.exports = async (req, res, next) => {
  // const { errors, isValid } = validateFacebookSignIn(req.body);
  // if (!isValid) {
  //   return res.status(400).json(errors);
  // }

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
      const now = new Date();

      if (!user) {
        const [firstName, lastName] = fbUser.name.split(" ");
        user = new User({
          fbId: fbUser.id,
          email,
          firstName: firstName || "",
          lastName: lastName || "",
          avatar: fbUser.picture.data.url,
          lastLogin: now,
          lastOpenedAt: now,
        });

        await user.save();
        console.log(`[app-open] facebook-sign-in (new): userId=${user._id} lastOpenedAt=${now.toISOString()}`);
      } else {
        // Check if user is archived
        if (user.isArchived) {
          return res.status(403).json({
            error: "Account archived",
            isArchived: true,
            userId: user._id.toString()
          });
        }

        // Real app-open: update both lastLogin and lastOpenedAt for existing users
        await User.findByIdAndUpdate(user._id, { lastLogin: now, lastOpenedAt: now });
        console.log(`[app-open] facebook-sign-in (existing): userId=${user._id} lastOpenedAt=${now.toISOString()}`);
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
    res.status(401).json({ success: false, error: "Invalid Facebook token" });
  }
};
