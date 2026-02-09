const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateChangePassword } = require("./validations");

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: "You are blocked" });
  }

  const { errors, isValid } = validateChangePassword(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const oldPassword = req.body.oldPassword;
  const password = req.body.password;

  let currentUser;
  try {
    currentUser = await User.findById(req.user.id);
  } catch (err) {
    console.log(`User ${req.user.id} failed to be found at change-password`);
    return next(err);
  }

  if (!currentUser) {
    return res.status(404).json({ general: "User not found" });
  }

  const passwordMatches = currentUser.comparePassword(oldPassword);

  if (!passwordMatches) {
    return res.status(400).json({ oldPassword: "Wrong password" });
  }

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOne({ userId: req.user.id });
  } catch (err) {
    console.log(
      `Refresh Token with userId ${
        req.user.id
      } failed to be found at change-password.`
    );
    return next(err);
  }

  if (refreshToken) {
    try {
      await RefreshToken.deleteOne({ userId: req.user.id });
    } catch (err) {
      console.log(
        `Refresh Token with key ${
          refreshToken.key
        } failed to be removed at change-password.`
      );
      return next(err);
    }
  }

  currentUser.password = password;
  currentUser.updatedAt = moment.utc().toDate();

  try {
    await currentUser.save();
  } catch (err) {
    console.log(
      `User with Id ${req.user.id} failed to be updated at change-password.`
    );
    return next(err);
  }

  return res.status(200).json({ general: "Success" });
};
