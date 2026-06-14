const moment = require("moment");

const { cleanSpaces, normalizeDateToNoonUTC } = require("../../helpers");
const { Photo } = require("../../models/photo");
const { User } = require("../../models/user");

const { validateEditUser } = require("./validations");

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  let user;
  try {
    user = await User.findOne({ _id: userId, isArchived: false });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ general: "User not found" });
    }

    console.log(`User with Id ${userId} failed to be found at edit-user.`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: "User not found" });
  }

  if (user.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ general: "Forbidden action" });
  }

  const data = req.body;

  const { errors, isValid } = validateEditUser(data);
  if (!isValid) return res.status(400).json(errors);

  if (
    data.avatar &&
    !data.avatar.includes("default") &&
    data.avatar !== user.avatar
  ) {
    let avatar;
    try {
      avatar = await Photo.findOne({ url: data.avatar });
    } catch (err) {
      console.log(`Avatar ${data.avatar} failed to be found at edit-user`);
      return next(err);
    }

    if (!avatar) {
      return res.status(404).json({ avatar: "Not found" });
    }

    user.avatar = data.avatar;
  } else if (data.avatar === "") {
    user.avatar = `https://s3.amazonaws.com/${
      process.env.AWS_S3_BUCKET
    }/users/avatars/default.png`;
  }

  user.description = data.description || user.description;

  user.disabilities = data.disabilities || user.disabilities;
  user.disability = data.disability || "";
  user.birthday = data.birthday ? normalizeDateToNoonUTC(data.birthday) : user.birthday;
  user.race = data.race || "";
  user.aboutMe = data.aboutMe || "";

  user.firstName = data.firstName
    ? cleanSpaces(data.firstName)
    : user.firstName;

  user.gender = data.gender || user.gender;

  user.isSubscribed =
    typeof data.isSubscribed !== "undefined"
      ? data.isSubscribed
      : user.isSubscribed;

  user.language = data.language || user.language;

  user.lastName = data.lastName ? cleanSpaces(data.lastName) : user.lastName;

  user.phone = data.phone || user.phone;

  user.showDisabilities =
    typeof data.showDisabilities !== "undefined"
      ? data.showDisabilities
      : user.showDisabilities;

  user.showEmail =
    typeof data.showEmail !== "undefined" ? data.showEmail : user.showEmail;

  user.showPhone =
    typeof data.showPhone !== "undefined" ? data.showPhone : user.showPhone;

  // Defensive: never assign undefined (the field is required:true). Legacy
  // docs predating the field resolve to true (visible); an explicit opt-out is
  // preserved. Avoids a save() validation failure when a legacy user edits any
  // other field without sending showNameOnLeaderboard.
  user.showNameOnLeaderboard =
    typeof data.showNameOnLeaderboard !== "undefined"
      ? data.showNameOnLeaderboard
      : user.showNameOnLeaderboard !== false;

  // Defensive: legacy docs predating the field resolve to "mapathon" (the
  // default) so a save() never trips the required+enum validation.
  user.connectionPreference =
    typeof data.connectionPreference !== "undefined"
      ? data.connectionPreference
      : user.connectionPreference || "mapathon";

  if (data.username && data.username !== user.username) {
    let repeatedUser;
    try {
      repeatedUser = await User.findOne({
        username: data.username,
        isArchived: false,
      });
    } catch (err) {
      console.log(
        `User with username ${data.username} failed to be found at edit-user.`
      );
      return next(err);
    }

    if (repeatedUser) {
      return res.status(400).json({ username: "Is already taken" });
    }

    user.username = data.username;
  }

  user.zip = data.zip ? cleanSpaces(data.zip) : user.zip;

  // Phase 2 user-profile fields
  if (typeof data.displayName !== "undefined") {
    user.displayName = data.displayName === null || data.displayName === ""
      ? null
      : cleanSpaces(data.displayName);
  }

  if (typeof data.socials !== "undefined" && data.socials !== null) {
    user.socials = user.socials || {};
    for (const key of ["twitter", "linkedin", "instagram", "facebook", "website"]) {
      if (typeof data.socials[key] !== "undefined") {
        user.socials[key] = cleanSpaces(data.socials[key] || "");
      }
    }
    // Ensure mongoose detects the nested change
    user.markModified("socials");
  }

  for (const f of ["profilePublic", "hideLocation", "hideBadges", "hideSupporters", "hideSocials"]) {
    if (typeof data[f] !== "undefined") {
      user[f] = data[f];
    }
  }

  user.updatedAt = moment.utc().toDate();

  try {
    await user.save();
  } catch (err) {
    if (typeof err.errors === "object") {
      const validationErrors = {};

      Object.keys(err.errors).forEach((key) => {
        validationErrors[key] = err.errors[key].message;
      });

      return res.status(400).json(validationErrors);
    }

    console.log(
      `User ${
        user.id
      } failed to be updated at edit-user.\nData: ${JSON.stringify(
        data,
        null,
        2
      )}`
    );
    return next(err);
  }

  const dataResponse = {
    id: user.id,
    avatar: user.avatar,
    description: user.description,
    race: user?.race,
    birthday: user?.birthday,
    disabilities: user.disabilities,
    firstName: user.firstName,
    disability: user.disability,
    email: user?.email,
    gender: user.gender,
    isSubscribed: user.isSubscribed,
    lastName: user.lastName,
    phone: user.phone,
    showDisabilities: user.showDisabilities,
    showEmail: user.showEmail,
    showPhone: user.showPhone,
    showNameOnLeaderboard: user.showNameOnLeaderboard !== false,
    connectionPreference: user.connectionPreference || "mapathon",
    username: user.username,
    zip: user.zip,
    aboutMe: user.aboutMe,
    // Phase 2 fields
    displayName: user.displayName ?? null,
    socials: user.socials || { twitter: "", linkedin: "", instagram: "", facebook: "", website: "" },
    profilePublic: user.profilePublic ?? false,
    hideLocation: user.hideLocation ?? false,
    hideBadges: user.hideBadges ?? false,
    hideSupporters: user.hideSupporters ?? false,
    hideSocials: user.hideSocials ?? false,
  };
  return res.status(200).json(dataResponse);
};
