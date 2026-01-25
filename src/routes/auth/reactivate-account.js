const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

/**
 * Reactivate an archived user account
 * Requires: userId (from 403 sign-in response), currentPassword (to prove ownership), newPassword
 * Security: User must know their original password to reactivate
 */
module.exports = async (req, res, next) => {
  const {
    userId,
    currentPassword,
    newPassword,
    firstName,
    lastName,
    email,
    disabilities,
    gender,
    zip,
    phone,
    showDisabilities,
    showEmail,
    showPhone,
    aboutMe,
    birthday,
    race,
    disability,
  } = req.body;

  // Validation
  if (!userId) {
    return res.status(400).json({ userId: "User ID is required" });
  }

  if (!currentPassword) {
    return res.status(400).json({ currentPassword: "Current password is required" });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ 
      newPassword: "New password must be at least 8 characters" 
    });
  }

  if (newPassword.length > 30) {
    return res.status(400).json({ 
      newPassword: "New password must be less than 31 characters" 
    });
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ 
      general: "First name and last name are required" 
    });
  }

  // Find user - use generic error to prevent enumeration
  let user;
  try {
    user = await User.findOne({ _id: userId, isArchived: true });
  } catch (err) {
    console.log(`Reactivation lookup failed for userId ${userId}`);
    return next(err);
  }

  if (!user) {
    return res.status(400).json({ general: "Invalid credentials" });
  }

  // Verify current password to prove account ownership
  if (!user.hashedPassword) {
    // User signed up via social login, redirect to forgot password
    return res.status(400).json({ 
      general: "This account was created with social login. Please use the 'Forgot Password' feature to set a password and reactivate your account."
    });
  }

  const passwordMatches = user.comparePassword(currentPassword);
  if (!passwordMatches) {
    return res.status(400).json({ general: "Invalid credentials" });
  }

  // Update user - set new password via the model's virtual setter
  user.password = newPassword;
  user.firstName = firstName;
  user.lastName = lastName;
  user.isArchived = false;
  user.lastLogin = new Date();
  user.inactivityEmailSent = false;
  user.inactivityEmailSentAt = null;
  user.reactivatedAt = new Date();
  user.updatedAt = moment.utc().toDate();

  // Add optional fields if provided
  if (email !== undefined) user.email = email;
  if (disabilities !== undefined) user.disabilities = disabilities;
  if (gender !== undefined) user.gender = gender;
  if (zip !== undefined) user.zip = zip;
  if (phone !== undefined) user.phone = phone;
  if (showDisabilities !== undefined) user.showDisabilities = showDisabilities;
  if (showEmail !== undefined) user.showEmail = showEmail;
  if (showPhone !== undefined) user.showPhone = showPhone;
  if (aboutMe !== undefined) user.aboutMe = aboutMe;
  if (birthday !== undefined) user.birthday = birthday;
  if (race !== undefined) user.race = race;
  if (disability !== undefined) user.disability = disability;

  try {
    await user.save();
  } catch (err) {
    console.log(`Failed to reactivate user ${user.id}`);
    return next(err);
  }

  // Generate tokens - use 7 days as default (non-rememberMe)
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
    console.log(`Refresh Token for userId ${user.id} failed to be created at reactivation.`);
    return next(err);
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return res.status(200).json({ 
    refreshToken: refreshToken.key, 
    token,
    general: "Account reactivated successfully"
  });
};
