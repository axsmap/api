const mongoose = require("mongoose");

const deviceInstallationSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, "Device ID is required"],
      unique: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android", "web"],
      required: [true, "Platform is required"],
    },
    fcmToken: {
      type: String,
      default: null,
    },
    // userId is null when device is first installed (user hasn't signed up yet)
    // Gets set when user signs up/logs in and device is linked via sign-in routes
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required: false,
    },
    installedAt: {
      type: Date,
      default: Date.now,
      required: [true, "Installation date is required"],
    },
    lastNotificationSent: {
      type: Date,
      default: null,
    },
    notificationType: {
      type: String,
      enum: [
        "download_24h",
        "inactivity_3d",
        "inactivity_7d",
        "inactivity_14d",
        "inactivity_30d",
        null,
      ],
      default: null,
    },
  },
  { timestamps: true }
);

deviceInstallationSchema.index({ deviceId: 1 });
deviceInstallationSchema.index({ userId: 1 });
deviceInstallationSchema.index({ installedAt: 1 });
deviceInstallationSchema.index({ fcmToken: 1 });

module.exports = {
  DeviceInstallation: mongoose.model(
    "DeviceInstallation",
    deviceInstallationSchema
  ),
  deviceInstallationSchema,
};
