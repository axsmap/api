const crypto = require("crypto");

const moment = require("moment");
const randomstring = require("randomstring");
const slugify = require("speakingurl");

const { ActivationTicket } = require("../../models/activation-ticket");
const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");
const { buildDisplayName } = require("../../helpers");

/**
 * Normalizes a date to noon UTC to avoid timezone issues.
 * This ensures the date stays the same regardless of client timezone.
 * @param {string|Date} dateInput - The date to normalize
 * @returns {Date|null} - Date at noon UTC or null if invalid
 */
const normalizeDateToNoonUTC = (dateInput) => {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

module.exports = async (req, res, next) => {
  const key = req.params.key;

  let activationTicket;
  try {
    activationTicket = await ActivationTicket.findOne({ key });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ general: "Activation ticket not found" });
    }
    return next(err);
  }

  if (!activationTicket) {
    return res.status(404).json({ general: "Activation ticket not found" });
  }

  let expiresAt = moment(activationTicket.expiresAt).utc();
  const now = moment.utc();
  if (expiresAt.isBefore(now)) {
    try {
      await ActivationTicket.deleteOne({ key });
    } catch (err) {
      return next(err);
    }

    return res.status(400).json({ general: "Activation ticket expired" });
  }

  const firstName = activationTicket?.userData?.firstName;
  const lastName = activationTicket?.userData?.lastName;
  const userData = {
    firstName,
    isSubscribed: activationTicket?.userData?.isSubscribed,
    lastName,
    password: activationTicket?.userData?.password,
    username: activationTicket?.userData?.username,
    displayName:
      (activationTicket?.userData?.displayName || "").trim() ||
      buildDisplayName(firstName, lastName),
    publicVisibility:
      activationTicket?.userData?.publicVisibility === "anonymous"
        ? "anonymous"
        : "displayName",
    aboutMe: activationTicket?.userData?.aboutMe || '',
    birthday: normalizeDateToNoonUTC(activationTicket?.userData?.dateOfBirth),
    disability: activationTicket?.userData?.disability || '',
    gender: activationTicket?.userData?.gender || 'not-to-say',
    race: activationTicket?.userData?.race || '',
    email: activationTicket?.email,
    // New account — they've been through signup/onboarding, so don't re-prompt.
    promptedForVisibility: true,
  };
  

  let repeatedUsers;
  try {
    repeatedUsers = await User.find({
      $or: [{ email: userData.email }, { username: userData.username }],
      isArchived: false,
    });
  } catch (err) {
    console.log("Users failed to be found at activate-account.");
    return next(err);
  }

  if (repeatedUsers && repeatedUsers.length > 0) {
    for (const user of repeatedUsers) {
      if (user.email === userData.email) {
        return res.status(400).json({ email: "Is already taken" });
      }

      let repeatedUser;
      do {
        userData.username = `${slugify(userData.firstName)}-${slugify(
          userData.lastName
        )}-${randomstring.generate({
          length: 5,
          capitalization: "lowercase",
        })}`;

        try {
          repeatedUser = await User.findOne({
            username: userData.username,
            isArchived: false,
          });
        } catch (err) {
          console.log(
            `User with username ${
              userData.username
            } failed to be found at activate-account.`
          );
          return next(err);
        }
      } while (repeatedUser && repeatedUser.username === userData.username);
    }
  }

  let user;
  try {
    user = await User.create(userData);
  } catch (err) {
    console.log(
      `User failed to be created at activate-account.\nData: ${JSON.stringify(
        userData
      )}`
    );
    return next(err);
  }

  const today = moment.utc();
  expiresAt = today.add(30, "days").toDate();
  const refreshTokenData = {
    expiresAt,
    key: `${user.id}${crypto.randomBytes(28).toString("hex")}`,
    userId: user.id,
  };

  try {
    await RefreshToken.create(refreshTokenData);
  } catch (err) {
    console.log(
      `Refresh token failed to be created at activate-account.\nData: ${JSON.stringify(
        refreshTokenData
      )}`
    );
    return next(err);
  }

  try {
    await ActivationTicket.deleteOne({ key });
  } catch (err) {
    console.log(
      `Activation ticket with key ${
        activationTicket.key
      } failed to be deleted at activate-account.`
    );
    return next(err);
  }

  // Use FRONTEND_URL environment variable for proper environment-specific redirects
  const frontendUrl = process.env.FRONTEND_URL || 'https://axsmap.com';
  return res.redirect(`${frontendUrl}/sign-in`);
};
