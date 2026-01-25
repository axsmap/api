const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

/**
 * Reactivate an archived user account
 * 
 * Requirements:
 * 1. User must set a NEW password
 * 2. User must resubmit all personal information (standard profile fields)
 * 3. After completion: isArchived = false, lastLogin = current date
 * 
 * Triggered when: User tries to login and isArchived = true
 */
module.exports = async (req, res, next) => {
  const {
    userId,
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

  console.log('[Reactivate] Request received:', { userId, hasNewPassword: !!newPassword, firstName, lastName });

  // Validation
  if (!userId) {
    console.log('[Reactivate] Error: Missing userId');
    return res.status(400).json({ userId: "User ID is required" });
  }

  if (!newPassword || newPassword.length < 8) {
    console.log('[Reactivate] Error: Invalid newPassword');
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
    console.log('[Reactivate] Error: Missing firstName or lastName');
    return res.status(400).json({ 
      general: "First name and last name are required" 
    });
  }

  // Find archived user
  let user;
  try {
    user = await User.findOne({ _id: userId, isArchived: true });
    console.log('[Reactivate] User lookup result:', { found: !!user, userId });
  } catch (err) {
    console.log(`[Reactivate] Database error looking up userId ${userId}:`, err.message);
    return next(err);
  }

  if (!user) {
    console.log('[Reactivate] Error: User not found or not archived');
    return res.status(400).json({ general: "Account not found or already active" });
  }

  // Update user with new password and profile information
  user.password = newPassword; // Uses model's virtual setter to hash
  user.firstName = firstName;
  user.lastName = lastName;
  user.isArchived = false;
  user.lastLogin = new Date();
  user.inactivityEmailSent = false;
  user.inactivityEmailSentAt = null;
  user.reactivatedAt = new Date();
  user.updatedAt = moment.utc().toDate();

  // Update all provided profile fields
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

  console.log('[Reactivate] Saving user updates...', { userId: user.id, isArchived: user.isArchived });

  try {
    await user.save();
    console.log('[Reactivate] User saved successfully');
  } catch (err) {
    console.log(`[Reactivate] Failed to save user ${user.id}:`, err.message);
    return next(err);
  }

  // Generate tokens - use 7 days as default
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
    console.log('[Reactivate] Refresh token created');
  } catch (err) {
    console.log(`[Reactivate] Refresh Token creation failed for userId ${user.id}:`, err.message);
    return next(err);
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  console.log('[Reactivate] SUCCESS - Account reactivated for userId:', user.id);

  return res.status(200).json({ 
    refreshToken: refreshToken.key, 
    token,
    general: "Account reactivated successfully"
  });
};
