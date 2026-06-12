const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateGenerateToken } = require("./validations");

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateGenerateToken(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const key = req.body.key;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOne({ key });
  } catch (err) {
    console.log(
      `Refresh Token with key ${key} failed to be found at generate-token.`
    );
    return next(err);
  }

  if (!refreshToken) {
    return res.status(404).json({ general: "Refresh Token not found" });
  }

  const expiresAt = moment(refreshToken.expiresAt).utc();
  const today = moment.utc();
  if (expiresAt.isBefore(today)) {
    try {
      await RefreshToken.deleteOne({ key });
    } catch (err) {
      console.log(
        `Refresh Token with key ${
          refreshToken.key
        } failed to be removed at generate-token.`
      );
      return next(err);
    }

    return res.status(401).json({ general: "Refresh Token expired" });
  }

  const token = jwt.sign(
    { userId: refreshToken.userId },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d',
    }
  );

  // Token refresh = the AXS Map app is being reopened (the user's previous
  // JWT expired and the client is exchanging the long-lived refresh token).
  // That's a real app-open event — set lastOpenedAt.
  try {
    const now = new Date();
    await User.findByIdAndUpdate(refreshToken.userId, { lastOpenedAt: now });
    console.log(`[app-open] token-refresh: userId=${refreshToken.userId} lastOpenedAt=${now.toISOString()}`);
  } catch (err) {
    console.log(`Failed to update lastOpenedAt on token refresh for userId ${refreshToken.userId}: ${err.message}`);
    // Don't fail the token-refresh if the activity update fails
  }

  return res.status(200).json({ token });
};
