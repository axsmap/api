const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

const { validateReactivateUser } = require("./validations");

/**
 * Reactivate an archived user account
 * User must provide userId (from archived login response), current password, and new password
 * This prevents account takeover - user must:
 * 1. Attempt login first (to get userId from 403 response)
 * 2. Know their original password
 */
module.exports = async (req, res, next) => {
  const { errors, isValid } = validateReactivateUser(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const { userId, currentPassword, newPassword, firstName, lastName } = req.body;

  let user;
  try {
    // Find the archived user by userId
    user = await User.findOne({ _id: userId, isArchived: true });
  } catch (err) {
    console.log(`Reactivation failed for userId ${userId}`);
    return next(err);
  }

  // Return generic error to prevent enumeration
  if (!user) {
    return res.status(400).json({ general: "Invalid credentials" });
  }

  // Verify current password to prove account ownership
  if (!user.hashedPassword) {
    // User signed up via social login, can't use password reactivation
    return res.status(400).json({ 
      general: "This account was created with social login. Please use Google or Facebook to sign in, then contact support if your account is archived."
    });
  }

  const passwordMatches = user.comparePassword(currentPassword);
  if (!passwordMatches) {
    return res.status(400).json({ general: "Invalid credentials" });
  }

  // Update user fields for reactivation
  user.isArchived = false;
  user.password = newPassword; // Will be hashed by the virtual setter
  user.firstName = firstName;
  user.lastName = lastName;
  user.lastLogin = new Date();
  user.inactivityEmailSent = false;
  user.inactivityEmailSentAt = null;
  user.reactivatedAt = new Date();
  user.updatedAt = moment.utc().toDate();

  // Update optional fields if provided
  if (req.body.phone) user.phone = req.body.phone;
  if (req.body.zip) user.zip = req.body.zip;
  if (req.body.gender) user.gender = req.body.gender;
  if (req.body.disabilities) user.disabilities = req.body.disabilities;

  try {
    await user.save();
  } catch (err) {
    console.log(`User with userId ${userId} failed to be reactivated.`);
    return next(err);
  }

  // Generate tokens for the reactivated user - use user.id instead of redeclaring
  const today = moment.utc();
  const expiresAt = today.add(7, "days").toDate();
  const key = `${user.id}${crypto.randomBytes(28).toString("hex")}`;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userId: user.id },
      { expiresAt, key, userId: user.id, rememberMe: false },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );
  } catch (err) {
    console.log(`Refresh Token for userId ${user.id} failed to be created at reactivate-user.`);
    return next(err);
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
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
