const { runInactivityCheck, runWeeklyReport } = require("../../helpers/inactivity-checker");

/**
 * Endpoint to trigger inactivity check
 * Should be called by a cron job daily
 * Protected by a secret key in the header
 */
module.exports = {
  runDailyCheck: async (req, res) => {
    // Verify the cron secret to prevent unauthorized access
    const cronSecret = req.headers["x-cron-secret"];
    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const result = await runInactivityCheck();
      return res.status(200).json({
        success: true,
        message: "Inactivity check completed",
        warningsSent: result.warningsSent.length,
        usersArchived: result.archivedUsers.length,
      });
    } catch (err) {
      console.error("[Cron] Failed to run inactivity check:", err.message);
      return res.status(500).json({ error: "Failed to run inactivity check" });
    }
  },

  runWeeklyReportEndpoint: async (req, res) => {
    // Verify the cron secret to prevent unauthorized access
    const cronSecret = req.headers["x-cron-secret"];
    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await runWeeklyReport();
      return res.status(200).json({
        success: true,
        message: "Weekly report sent",
      });
    } catch (err) {
      console.error("[Cron] Failed to send weekly report:", err.message);
      return res.status(500).json({ error: "Failed to send weekly report" });
    }
  },
};
