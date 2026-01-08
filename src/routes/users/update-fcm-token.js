const { User } = require("../../models/user");
const { DeviceInstallation } = require("../../models/device-installation");

module.exports = async (req, res, next) => {
  // Note: Field name 'fcmToken' is kept for backward compatibility
  // but now stores OneSignal player ID
  const { fcmToken, deviceId } = req.body;

  if (!fcmToken) {
    return res.status(400).json({
      general: "fcmToken (OneSignal player ID) is required",
    });
  }

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ general: "User not found" });
    }

    // Update user's token (stores OneSignal player ID in fcmToken field)
    user.fcmToken = fcmToken;
    await user.save();

    // If deviceId is provided, also update/link the device installation
    if (deviceId) {
      await DeviceInstallation.findOneAndUpdate(
        { deviceId },
        {
          userId: user._id,
          fcmToken: fcmToken, // Stores OneSignal player ID
        },
        { upsert: false }
      );
    }

    return res.status(200).json({
      message: "OneSignal player ID updated successfully",
    });
  } catch (err) {
    console.error(`Token update failed: ${err.message}`);
    return next(err);
  }
};
