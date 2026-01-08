const axios = require("axios");

const { User } = require("../models/user");
const { DeviceInstallation } = require("../models/device-installation");

/**
 * Send push notification using OneSignal (ACTIVE)
 * @param {string} playerId - OneSignal player ID / device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} OneSignal response
 */
async function sendPushNotificationOneSignal(playerId, title, body, data = {}) {
  if (!playerId) {
    throw new Error("OneSignal player ID is required");
  }

  const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
  const oneSignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!oneSignalAppId || !oneSignalRestApiKey) {
    console.warn(
      "OneSignal credentials not configured. Push notifications disabled."
    );
    return null;
  }

  const payload = {
    app_id: oneSignalAppId,
    include_player_ids: [playerId],
    headings: { en: title },
    contents: { en: body },
    data: data,
    sound: "default",
    priority: 10,
  };

  try {
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${oneSignalRestApiKey}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error sending OneSignal push notification:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Send push notification using FCM (Firebase Cloud Messaging) - INACTIVE
 * Kept for reference/backup purposes
 * @param {string} fcmToken - FCM token for the device
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} FCM response
 */
async function sendPushNotificationFCM(fcmToken, title, body, data = {}) {
  // FCM is currently inactive - OneSignal is the active service
  // This function is kept for reference/backup purposes
  // eslint-disable-next-line no-unused-vars
  const _unused = { fcmToken, title, body, data };
  console.log(
    "[FCM INACTIVE] FCM notification call intercepted. Use OneSignal instead."
  );
  return null;

  /* FCM CODE - KEPT FOR REFERENCE (INACTIVE)
  if (!fcmToken) {
    throw new Error("FCM token is required");
  }

  const fcmServerKey = process.env.FCM_SERVER_KEY;
  if (!fcmServerKey) {
    console.warn("FCM_SERVER_KEY not configured. Push notifications disabled.");
    return null;
  }

  const payload = {
    to: fcmToken,
    notification: {
      title,
      body,
      sound: "default",
      badge: "1",
    },
    data: {
      ...data,
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
    priority: "high",
  };

  try {
    const response = await axios.post(
      "https://fcm.googleapis.com/fcm/send",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmServerKey}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error sending push notification:", error.message);
    throw error;
  }
  */
}

/**
 * Send push notification - Main function (uses OneSignal)
 * @param {string} playerId - OneSignal player ID / device token (previously fcmToken)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} Notification response
 */
async function sendPushNotification(playerId, title, body, data = {}) {
  // OneSignal is the active service
  return sendPushNotificationOneSignal(playerId, title, body, data);
}

/**
 * Send notification to a user by their ID
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} Notification result
 */
async function sendNotificationToUser(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      console.log(`User ${userId} not found`);
      return null;
    }

    // OneSignal uses fcmToken field to store player ID
    // (field name kept for backward compatibility)
    if (!user.fcmToken) {
      console.log(`No OneSignal player ID found for user ${userId}`);
      return null;
    }

    const result = await sendPushNotification(user.fcmToken, title, body, data);
    return result;
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user notification tracking
 * @param {string} userId - User ID
 * @param {string} notificationType - Type of notification sent
 * @returns {Promise<void>}
 */
async function updateUserNotificationSent(userId, notificationType) {
  try {
    await User.findByIdAndUpdate(userId, {
      lastNotificationSent: new Date(),
      notificationType,
    });
  } catch (error) {
    console.error(
      `Error updating user notification tracking for ${userId}:`,
      error
    );
  }
}

/**
 * Send notification to a device by deviceId (for pre-sign-up users)
 * @param {string} deviceId - Device ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} Notification result
 */
async function sendNotificationToDevice(deviceId, title, body, data = {}) {
  try {
    const device = await DeviceInstallation.findOne({
      deviceId,
      fcmToken: { $ne: null },
    });
    if (!device) {
      console.log(
        `No device with OneSignal player ID found for device ${deviceId}`
      );
      return null;
    }

    // OneSignal uses fcmToken field to store player ID
    // (field name kept for backward compatibility)
    const result = await sendPushNotification(
      device.fcmToken,
      title,
      body,
      data
    );
    return result;
  } catch (error) {
    console.error(`Error sending notification to device ${deviceId}:`, error);
    throw error;
  }
}

/**
 * Update device notification tracking
 * @param {string} deviceId - Device ID
 * @param {string} notificationType - Type of notification sent
 * @returns {Promise<void>}
 */
async function updateDeviceNotificationSent(deviceId, notificationType) {
  try {
    await DeviceInstallation.findOneAndUpdate(
      { deviceId },
      {
        lastNotificationSent: new Date(),
        notificationType,
      }
    );
  } catch (error) {
    console.error(
      `Error updating device notification tracking for ${deviceId}:`,
      error
    );
  }
}

module.exports = {
  sendPushNotification, // Active: Uses OneSignal
  sendPushNotificationOneSignal, // OneSignal implementation
  sendPushNotificationFCM, // Inactive: Firebase (kept for reference)
  sendNotificationToUser,
  sendNotificationToDevice,
  updateUserNotificationSent,
  updateDeviceNotificationSent,
};
