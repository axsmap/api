const { DeviceInstallation } = require("../../models/device-installation");

module.exports = async (req, res, next) => {
  // Note: Field name 'fcmToken' is kept for backward compatibility
  // but now stores OneSignal player ID
  const { deviceId, platform, fcmToken } = req.body;

  if (!deviceId || !platform) {
    return res.status(400).json({
      general: "deviceId and platform are required",
    });
  }

  if (!["ios", "android", "web"].includes(platform)) {
    return res.status(400).json({
      general: "platform must be one of: ios, android, web",
    });
  }

  try {
    // Check if device already exists
    let device = await DeviceInstallation.findOne({ deviceId });

    if (device) {
      // Update existing device
      device.platform = platform;
      // fcmToken field stores OneSignal player ID
      device.fcmToken = fcmToken || device.fcmToken;
      device.updatedAt = new Date();

      await device.save();
      return res.status(200).json({
        message: "Device updated successfully",
        device: {
          deviceId: device.deviceId,
          platform: device.platform,
          installedAt: device.installedAt,
        },
      });
    }

    // Create new device installation record
    // fcmToken field stores OneSignal player ID
    device = await DeviceInstallation.create({
      deviceId,
      platform,
      fcmToken: fcmToken || null,
      installedAt: new Date(),
    });

    return res.status(201).json({
      message: "Device registered successfully",
      device: {
        deviceId: device.deviceId,
        platform: device.platform,
        installedAt: device.installedAt,
      },
    });
  } catch (err) {
    console.error(`Device registration failed: ${err.message}`);
    return next(err);
  }
};
