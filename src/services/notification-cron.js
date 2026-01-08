const cron = require("node-cron");
const { processAllNotifications } = require("./notification-scheduler");

/**
 * Initialize the notification scheduler cron job
 * Runs daily at 9:00 AM UTC
 */
function initializeNotificationScheduler() {
  // Schedule daily at 9:00 AM UTC
  const cronSchedule = process.env.NOTIFICATION_CRON_SCHEDULE || "0 9 * * *";

  console.log(
    `Initializing notification scheduler with schedule: ${cronSchedule}`
  );

  cron.schedule(cronSchedule, async () => {
    console.log("Running scheduled notification check...");
    try {
      await processAllNotifications();
    } catch (error) {
      console.error("Error in scheduled notification check:", error);
    }
  });

  // Also run immediately on startup if in development (optional)
  if (
    process.env.NODE_ENV === "development" &&
    process.env.RUN_NOTIFICATIONS_ON_STARTUP === "true"
  ) {
    console.log("Running notification check on startup (development mode)...");
    setTimeout(async () => {
      try {
        await processAllNotifications();
      } catch (error) {
        console.error("Error in startup notification check:", error);
      }
    }, 5000); // Wait 5 seconds for DB connection
  }
}

module.exports = {
  initializeNotificationScheduler,
};
