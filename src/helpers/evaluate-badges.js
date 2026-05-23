const { Badge } = require("../models/badge");
const { Review } = require("../models/review");
const { User } = require("../models/user");
const { UserBadge } = require("../models/user-badge");

/**
 * Check every active badge rule against this user and award any that match.
 *
 * Called after create-review. Idempotent — duplicate award attempts are
 * absorbed by the {user, badge, event} unique index.
 *
 * Currently supported rule shape:
 *   { type: "review_count", gte: <number> }
 *
 * Unknown rule types are silently skipped (locked-badge UI handles those).
 *
 * Never throws — badge evaluation must not fail the parent request.
 */
async function evaluateBadges({ userId, eventId } = {}) {
  if (!userId) return [];

  try {
    const badges = await Badge.find({ isActive: true }).lean();
    if (badges.length === 0) return [];

    const newlyEarned = [];

    for (const badge of badges) {
      const rule = badge.rule || {};
      if (rule.type !== "review_count") continue;
      const threshold = Number(rule.gte);
      if (!Number.isFinite(threshold) || threshold < 1) continue;

      let count;
      let event = null;

      if (badge.scope === "lifetime") {
        const u = await User.findById(userId).select("reviewsAmount").lean();
        if (!u) continue;
        count = u.reviewsAmount || 0;
      } else if (badge.scope === "mapathon") {
        if (!eventId) continue; // mapathon badges only evaluate when a review names an event
        event = eventId;
        count = await Review.countDocuments({
          user: userId,
          event: eventId,
          isBanned: { $ne: true },
        });
      } else {
        continue;
      }

      if (count < threshold) continue;

      try {
        const result = await UserBadge.updateOne(
          { user: userId, badge: badge._id, event },
          {
            $setOnInsert: {
              user: userId,
              badge: badge._id,
              event,
              awardedAt: new Date(),
              isSuppressed: false,
              progress: 1,
            },
          },
          { upsert: true }
        );
        if (result.upsertedCount > 0) {
          newlyEarned.push({ slug: badge.slug, scope: badge.scope, event });
          console.log(
            `[badge] awarded slug=${badge.slug} user=${userId}` +
              (event ? ` event=${event}` : "")
          );
        }
      } catch (err) {
        // Unique-index dup is the expected idempotent path; ignore.
        if (err && err.code !== 11000) {
          console.log(`[badge] award failed slug=${badge.slug}: ${err.message}`);
        }
      }
    }

    return newlyEarned;
  } catch (err) {
    console.log(`[badge] evaluator error for user ${userId}: ${err.message}`);
    return [];
  }
}

module.exports = { evaluateBadges };
