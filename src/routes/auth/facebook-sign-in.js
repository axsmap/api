const crypto = require("crypto");

const axios = require("axios");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateFacebookSignIn } = require("./validations");

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateFacebookSignIn(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const code = req.body.code;
  try {
    const fbUserResponse = await axios.get(`https://graph.facebook.com/me`, {
      params: {
        access_token: code,
        fields: "id,name,email,picture",
      },
    });

    const fbUser = fbUserResponse.data;
    if (fbUser.email) {
      const email = fbUser.email;

      let user = await User.findOne({ facebookId: fbUser.id });

      const [firstName, lastName] = fbUser.name.split(" ");

      if (!user) {
        user = new User({
          fbId: fbUser.id,
          email,
          firstName: firstName || "",
          lastName: lastName || "",
          picture: fbUser.picture.data.url,
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
    } else {
      res
        .status(400)
        .json({
          success: false,
          error: "Email is not linked with this account",
        });
    }
  } catch (err) {
    res.status(401).json({ success: false, error: "Invalid Facebook token" });
  }
};
