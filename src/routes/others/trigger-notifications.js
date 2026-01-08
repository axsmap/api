const {
  processAllNotifications,
} = require("../../services/notification-scheduler");

module.exports = async (req, res, next) => {
  // Only allow admins to manually trigger notifications
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ general: "Forbidden action" });
  }

  try {
    const results = await processAllNotifications();
    return res.status(200).json({
      message: "Notifications processed successfully",
      results,
    });
  } catch (error) {
    console.error("Error triggering notifications:", error);
    return next(error);
  }
};
