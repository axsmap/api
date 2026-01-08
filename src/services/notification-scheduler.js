const moment = require("moment");

const { User } = require("../models/user");
const { DeviceInstallation } = require("../models/device-installation");
const {
  sendNotificationToUser,
  sendNotificationToDevice,
  updateUserNotificationSent,
  updateDeviceNotificationSent,
} = require("../helpers/push-notifications");

/**
 * Notification messages configuration
 */
const NOTIFICATION_MESSAGES = {
  DOWNLOAD_24H: {
    title: "Welcome to AXS Map!",
    body: "Don't forget to sign in! Start mapping today!",
  },
  INACTIVITY_3D: {
    title: "Hey! Miss us?",
    body: "We miss you! Leave a review today!",
  },
  INACTIVITY_7D: {
    title: "Was it something I said?",
    body: "Leave a review today!",
  },
  INACTIVITY_14D: {
    title: "Remember me?",
    body: "Let's explore today!",
  },
  INACTIVITY_30D: {
    title: "Accessibility affects everyone",
    body: "We'll be here when you get back!",
  },
};

/**
 * Check and send notifications for devices that downloaded but never signed in (24 hours)
 * This handles both:
 * 1. Devices registered via POST /devices/register (no user account yet)
 * 2. Users created but never signed in (lastSignIn = null)
 */
async function checkDownloadButNoSignIn() {
  try {
    const twentyFourHoursAgo = moment.utc().subtract(24, "hours").toDate();
    const twentyFiveHoursAgo = moment.utc().subtract(25, "hours").toDate();

    let processedCount = 0;

    // 1. Find devices installed 24 hours ago that have no userId (never signed up/logged in)
    const devices = await DeviceInstallation.find({
      userId: null,
      installedAt: {
        $gte: twentyFiveHoursAgo,
        $lte: twentyFourHoursAgo,
      },
      fcmToken: { $ne: null },
      $or: [
        { notificationType: { $ne: "download_24h" } },
        { notificationType: null },
      ],
    });

    console.log(
      `Found ${devices.length} devices installed 24h ago but never signed up`
    );

    for (const device of devices) {
      try {
        await sendNotificationToDevice(
          device.deviceId,
          NOTIFICATION_MESSAGES.DOWNLOAD_24H.title,
          NOTIFICATION_MESSAGES.DOWNLOAD_24H.body,
          { type: "download_24h" }
        );

        await updateDeviceNotificationSent(device.deviceId, "download_24h");
        console.log(
          `Sent download_24h notification to device ${device.deviceId}`
        );
        processedCount++;
      } catch (error) {
        console.error(
          `Error sending notification to device ${device.deviceId}:`,
          error
        );
      }
    }

    // 2. Find users created 24 hours ago that have never signed in (lastSignIn = null)
    // This handles cases where user account was created but they never logged in
    const users = await User.find({
      lastSignIn: null,
      createdAt: {
        $gte: twentyFiveHoursAgo,
        $lte: twentyFourHoursAgo,
      },
      isArchived: false,
      isBlocked: false,
      fcmToken: { $ne: null },
      $or: [
        { notificationType: { $ne: "download_24h" } },
        { notificationType: null },
      ],
    });

    console.log(
      `Found ${users.length} users created 24h ago but never signed in`
    );

    for (const user of users) {
      try {
        await sendNotificationToUser(
          user._id.toString(),
          NOTIFICATION_MESSAGES.DOWNLOAD_24H.title,
          NOTIFICATION_MESSAGES.DOWNLOAD_24H.body,
          { type: "download_24h" }
        );

        await updateUserNotificationSent(user._id.toString(), "download_24h");
        console.log(`Sent download_24h notification to user ${user._id}`);
        processedCount++;
      } catch (error) {
        console.error(`Error sending notification to user ${user._id}:`, error);
      }
    }

    return { processed: processedCount };
  } catch (error) {
    console.error("Error in checkDownloadButNoSignIn:", error);
    throw error;
  }
}

/**
 * Check and send notifications for inactive users based on last_sign_in
 * @param {number} daysInactive - Number of days of inactivity
 * @param {string} notificationType - Type of notification
 * @param {Object} message - Notification message object
 */
async function checkInactiveUsers(daysInactive, notificationType, message) {
  try {
    // Check for users who signed in exactly X days ago (with 24 hour window to catch all users)
    const daysAgoStart = moment
      .utc()
      .subtract(daysInactive + 1, "days")
      .toDate();
    const daysAgoEnd = moment.utc().subtract(daysInactive, "days").toDate();

    // Find users who haven't signed in for exactly the specified days
    // and haven't received this specific notification yet
    const users = await User.find({
      lastSignIn: {
        $gte: daysAgoStart,
        $lte: daysAgoEnd,
      },
      isArchived: false,
      isBlocked: false,
      fcmToken: { $ne: null },
      $or: [
        { notificationType: { $ne: notificationType } },
        { notificationType: null },
      ],
    });

    console.log(
      `Found ${users.length} users inactive for ${daysInactive} days`
    );

    for (const user of users) {
      try {
        await sendNotificationToUser(
          user._id.toString(),
          message.title,
          message.body,
          { type: notificationType }
        );

        await updateUserNotificationSent(user._id.toString(), notificationType);
        console.log(
          `Sent ${notificationType} notification to user ${user._id}`
        );
      } catch (error) {
        console.error(`Error sending notification to user ${user._id}:`, error);
      }
    }

    return { processed: users.length };
  } catch (error) {
    console.error(
      `Error in checkInactiveUsers for ${daysInactive} days:`,
      error
    );
    throw error;
  }
}

/**
 * Process all notification checks
 */
async function processAllNotifications() {
  try {
    console.log("Starting notification scheduler...");
    const startTime = moment.utc();

    // Download but no sign-in (24 hours)
    const downloadResult = await checkDownloadButNoSignIn();

    // Inactivity notifications
    const inactivity3d = await checkInactiveUsers(
      3,
      "inactivity_3d",
      NOTIFICATION_MESSAGES.INACTIVITY_3D
    );
    const inactivity7d = await checkInactiveUsers(
      7,
      "inactivity_7d",
      NOTIFICATION_MESSAGES.INACTIVITY_7D
    );
    const inactivity14d = await checkInactiveUsers(
      14,
      "inactivity_14d",
      NOTIFICATION_MESSAGES.INACTIVITY_14D
    );
    const inactivity30d = await checkInactiveUsers(
      30,
      "inactivity_30d",
      NOTIFICATION_MESSAGES.INACTIVITY_30D
    );

    const endTime = moment.utc();
    const duration = moment.duration(endTime.diff(startTime));

    console.log("Notification scheduler completed:", {
      download_24h: downloadResult.processed,
      inactivity_3d: inactivity3d.processed,
      inactivity_7d: inactivity7d.processed,
      inactivity_14d: inactivity14d.processed,
      inactivity_30d: inactivity30d.processed,
      duration: `${duration.asSeconds()}s`,
    });

    return {
      download_24h: downloadResult.processed,
      inactivity_3d: inactivity3d.processed,
      inactivity_7d: inactivity7d.processed,
      inactivity_14d: inactivity14d.processed,
      inactivity_30d: inactivity30d.processed,
    };
  } catch (error) {
    console.error("Error in processAllNotifications:", error);
    throw error;
  }
}

module.exports = {
  checkDownloadButNoSignIn,
  checkInactiveUsers,
  processAllNotifications,
  NOTIFICATION_MESSAGES,
};
