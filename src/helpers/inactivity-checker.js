const moment = require("moment");
const { User } = require("../models/user");
const { RefreshToken } = require("../models/refresh-token");
const { sendEmail } = require("../helpers");
const {
  inactivityWarningEmailTemplate,
  accountArchivedEmailTemplate,
  weeklyInactivityReportEmailTemplate,
} = require("../helpers/mail-template");

const INACTIVITY_THRESHOLD_DAYS = 365; // 1 year
const ARCHIVE_GRACE_PERIOD_DAYS = 7; // 7 days after warning email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@axsmap.com";
const APP_URL = process.env.APP_URL || "https://www.axsmap.com";

/**
 * Find users who haven't logged in for over a year and haven't received an inactivity email yet
 * Send them a warning email
 * Note: Only users with a recorded lastLogin will be checked (no fallback to createdAt)
 */
async function sendInactivityWarnings() {
  const oneYearAgo = moment.utc().subtract(INACTIVITY_THRESHOLD_DAYS, "days").toDate();
  
  try {
    // Only check users who have lastLogin recorded (not null)
    const inactiveUsers = await User.find({
      isArchived: false,
      isBlocked: false,
      inactivityEmailSent: { $ne: true },
      lastLogin: { $ne: null, $lt: oneYearAgo }
    }).select("_id email firstName lastName lastLogin");

    console.log(`[Inactivity Check] Found ${inactiveUsers.length} users to send warnings to`);

    const warningsSent = [];

    for (const user of inactiveUsers) {
      try {
        const loginUrl = `${APP_URL}/sign-in`;
        const displayName = user.firstName || "User";
        const emailContent = inactivityWarningEmailTemplate(
          displayName,
          loginUrl
        );

        await sendEmail({
          receiversEmails: [user.email],
          subject: "We miss you! Your AXS Map account needs attention",
          htmlContent: emailContent,
          textContent: `Hi ${displayName}, we noticed you haven't logged into AXS Map in over a year. Please log in within 7 days to keep your account active.`,
        });

        // Mark that we've sent the inactivity email
        await User.findByIdAndUpdate(user._id, {
          inactivityEmailSent: true,
          inactivityEmailSentAt: new Date(),
        });

        warningsSent.push({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });

        console.log(`[Inactivity Check] Warning email sent to ${user.email}`);
      } catch (emailErr) {
        console.error(`[Inactivity Check] Failed to send warning email to ${user.email}:`, emailErr.message);
      }
    }

    return warningsSent;
  } catch (err) {
    console.error("[Inactivity Check] Error finding inactive users:", err.message);
    return [];
  }
}

/**
 * Find users who received an inactivity email more than 7 days ago and still haven't logged in
 * Archive their accounts
 */
async function archiveInactiveUsers() {
  const sevenDaysAgo = moment.utc().subtract(ARCHIVE_GRACE_PERIOD_DAYS, "days").toDate();

  try {
    const usersToArchive = await User.find({
      isArchived: false,
      inactivityEmailSent: true,
      inactivityEmailSentAt: { $lt: sevenDaysAgo },
    }).select("_id email firstName lastName");

    console.log(`[Inactivity Check] Found ${usersToArchive.length} users to archive`);

    const archivedUsers = [];

    for (const user of usersToArchive) {
      try {
        // Archive the user
        await User.findByIdAndUpdate(user._id, {
          isArchived: true,
          updatedAt: new Date(),
        });

        // Delete their refresh token
        await RefreshToken.deleteOne({ userId: user._id.toString() });

        // Send archived notification email
        const reactivateUrl = `${APP_URL}/reactivate-account`;
        const displayName = user.firstName || "User";
        const emailContent = accountArchivedEmailTemplate(
          displayName,
          reactivateUrl
        );

        await sendEmail({
          receiversEmails: [user.email],
          subject: "Your AXS Map account has been archived",
          htmlContent: emailContent,
          textContent: `Hi ${displayName}, your AXS Map account has been archived due to inactivity. You can reactivate it anytime by visiting ${reactivateUrl}`,
        });

        archivedUsers.push({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });

        console.log(`[Inactivity Check] Archived user ${user.email}`);
      } catch (archiveErr) {
        console.error(`[Inactivity Check] Failed to archive user ${user.email}:`, archiveErr.message);
      }
    }

    return archivedUsers;
  } catch (err) {
    console.error("[Inactivity Check] Error archiving inactive users:", err.message);
    return [];
  }
}

/**
 * Get count of users reactivated in the past week
 * Uses reactivatedAt timestamp set during account reactivation
 */
async function getReactivatedUsersCount() {
  const oneWeekAgo = moment.utc().subtract(7, "days").toDate();

  try {
    const count = await User.countDocuments({
      isArchived: false,
      reactivatedAt: { $gte: oneWeekAgo },
    });
    return count;
  } catch (err) {
    console.error("[Inactivity Check] Error counting reactivated users:", err.message);
    return 0;
  }
}

/**
 * Send weekly report to admin team
 */
async function sendWeeklyReport(warningsSent, archivedUsers) {
  const weekEndDate = moment.utc().format("MMMM D, YYYY");
  const weekStartDate = moment.utc().subtract(7, "days").format("MMMM D, YYYY");

  const totalReactivated = await getReactivatedUsersCount();

  const reportData = {
    weekStartDate,
    weekEndDate,
    totalWarningsSent: warningsSent.length,
    totalArchived: archivedUsers.length,
    totalReactivated,
    archivedUsers,
    warningsSentUsers: warningsSent,
  };

  const emailContent = weeklyInactivityReportEmailTemplate(reportData);

  try {
    await sendEmail({
      receiversEmails: [ADMIN_EMAIL],
      subject: `AXS Map Weekly Inactivity Report - ${weekEndDate}`,
      htmlContent: emailContent,
      textContent: `Weekly Inactivity Report: ${warningsSent.length} warnings sent, ${archivedUsers.length} users archived, ${totalReactivated} users reactivated.`,
    });

    console.log(`[Inactivity Check] Weekly report sent to ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error("[Inactivity Check] Failed to send weekly report:", err.message);
  }
}

/**
 * Main function to run the inactivity check process
 * This should be called by a cron job daily
 */
async function runInactivityCheck() {
  console.log("[Inactivity Check] Starting inactivity check process...");

  // Step 1: Send warnings to users who haven't logged in for over a year
  const warningsSent = await sendInactivityWarnings();

  // Step 2: Archive users who didn't respond to warnings within 7 days
  const archivedUsers = await archiveInactiveUsers();

  console.log(`[Inactivity Check] Completed. Warnings sent: ${warningsSent.length}, Users archived: ${archivedUsers.length}`);

  return {
    warningsSent,
    archivedUsers,
  };
}

/**
 * Run the weekly report (should be called once per week)
 */
async function runWeeklyReport() {
  console.log("[Inactivity Check] Generating weekly report...");

  // Get data from the past week
  const oneWeekAgo = moment.utc().subtract(7, "days").toDate();

  // Users who received warnings this week
  const warningsSentUsers = await User.find({
    inactivityEmailSentAt: { $gte: oneWeekAgo },
  }).select("email firstName lastName");

  // Users archived this week
  const archivedUsers = await User.find({
    isArchived: true,
    updatedAt: { $gte: oneWeekAgo },
  }).select("email firstName lastName");

  await sendWeeklyReport(warningsSentUsers, archivedUsers);
}

module.exports = {
  runInactivityCheck,
  runWeeklyReport,
  sendInactivityWarnings,
  archiveInactiveUsers,
};
