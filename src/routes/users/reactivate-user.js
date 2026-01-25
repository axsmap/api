const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateReactivateUser } = require("./validations");

/**
 * Reactivate an archived user account
 * User must provide email, new password, and required profile fields
 */
module.exports = async (req, res, next) => {
  const { errors, isValid } = validateReactivateUser(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const { email, password, firstName, lastName } = req.body;

  let user;
  try {
    // Find the archived user by email
    user = await User.findOne({ email, isArchived: true });
  } catch (err) {
    console.log(`User with email ${email} failed to be found at reactivate-user.`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: "Archived account not found with this email" });
  }

  // Update user fields for reactivation
  user.isArchived = false;
  user.password = password; // Will be hashed by the virtual setter
  user.firstName = firstName;
  user.lastName = lastName;
  user.lastLogin = new Date();
  user.inactivityEmailSent = false;
  user.inactivityEmailSentAt = null;
  user.updatedAt = moment.utc().toDate();

  // Update optional fields if provided
  if (req.body.phone) user.phone = req.body.phone;
  if (req.body.zip) user.zip = req.body.zip;
  if (req.body.gender) user.gender = req.body.gender;
  if (req.body.disabilities) user.disabilities = req.body.disabilities;

  try {
    await user.save();
  } catch (err) {
    console.log(`User with email ${email} failed to be reactivated.`);
    return next(err);
  }

  // Generate tokens for the reactivated user
  const userId = user.id;
  const today = moment.utc();
  const expiresAt = today.add(7, "days").toDate();
  const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId, rememberMe: false },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );
  } catch (err) {
    console.log(`Refresh Token for userId ${userId} failed to be created at reactivate-user.`);
    return next(err);
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return res.status(200).json({
    general: "Account reactivated successfully",
    token,
    refreshToken: refreshToken.key,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    }
  });
};
