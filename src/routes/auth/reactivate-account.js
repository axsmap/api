const bcrypt = require("bcrypt-nodejs");
const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const moment = require("moment");

const { RefreshToken } = require("../../models/refresh-token");
const { User } = require("../../models/user");

/**
 * Reactivate an archived user account
 * Requires: userId, new password, and updated profile information
 * Sets isArchived to false and updates lastLogin
 */
module.exports = async (req, res, next) => {
  const {
    userId,
    password,
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
    return res.status(400).json({ general: "User ID is required" });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ 
      password: "Password must be at least 6 characters" 
    });
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ 
      general: "First name and last name are required" 
    });
  }

  if (!email) {
    return res.status(400).json({ email: "Email is required" });
  }

  // Find user
  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    console.log(`User with ID ${userId} failed to be found at reactivation.`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: "User not found" });
  }

  if (!user.isArchived) {
    return res.status(400).json({ 
      general: "Account is not archived" 
    });
  }

  // Hash new password
  let hashedPassword;
  try {
    hashedPassword = await new Promise((resolve, reject) => {
      bcrypt.genSalt(10, (saltErr, salt) => {
        if (saltErr) return reject(saltErr);
        
        bcrypt.hash(password, salt, null, (hashErr, hash) => {
          if (hashErr) return reject(hashErr);
          resolve(hash);
        });
      });
    });
  } catch (err) {
    console.log("Failed to hash password during reactivation");
    return next(err);
  }

  // Prepare update data
  const updateData = {
    hashedPassword,
    firstName,
    lastName,
    email,
    isArchived: false,
    lastLogin: new Date(),
    inactivityEmailSent: false,
    inactivityEmailSentAt: null,
  };

  // Add optional fields if provided
  if (disabilities !== undefined) updateData.disabilities = disabilities;
  if (gender !== undefined) updateData.gender = gender;
  if (zip !== undefined) updateData.zip = zip;
  if (phone !== undefined) updateData.phone = phone;
  if (showDisabilities !== undefined) updateData.showDisabilities = showDisabilities;
  if (showEmail !== undefined) updateData.showEmail = showEmail;
  if (showPhone !== undefined) updateData.showPhone = showPhone;
  if (aboutMe !== undefined) updateData.aboutMe = aboutMe;
  if (birthday !== undefined) updateData.birthday = birthday;
  if (race !== undefined) updateData.race = race;
  if (disability !== undefined) updateData.disability = disability;

  // Update user
  try {
    user = await User.findByIdAndUpdate(userId, updateData, { new: true });
  } catch (err) {
    console.log(`Failed to reactivate user ${userId}`);
    return next(err);
  }

  // Generate tokens
  const today = moment.utc();
  const expiresAt = today.add(30, "days").toDate();
  const key = `${userId}${crypto.randomBytes(28).toString("hex")}`;

  let refreshToken;
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    );
  } catch (err) {
    console.log(`Refresh Token for userId ${userId} failed to be created at reactivation.`);
    return next(err);
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  return res.status(200).json({ 
    refreshToken: refreshToken.key, 
    token,
    message: "Account reactivated successfully"
  });
};
