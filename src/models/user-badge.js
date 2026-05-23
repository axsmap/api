const mongoose = require("mongoose");

// Per-user badge award. progress=1 means earned; <1 means in-progress (display
// with a locked-style UI on the frontend). isSuppressed=true means the badge
// was admin-removed (kept in collection for audit trail).
const userBadgeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
      index: true,
    },
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Badge",
      required: [true, "Is required"],
    },
    // Only set for mapathon-scoped badges.
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
    awardedAt: { type: Date, default: Date.now },
    isSuppressed: { type: Boolean, default: false },
    // 0..1 — 1 = awarded, <1 = locked with progress. Evaluator only writes 1.
    progress: { type: Number, default: 1, min: 0, max: 1 },
  },
  { timestamps: true }
);

// Unique award per (user, badge, event). `event: null` is treated as a value
// by Mongo, so lifetime badges still get a single row per user.
userBadgeSchema.index({ user: 1, badge: 1, event: 1 }, { unique: true });

module.exports = {
  UserBadge: mongoose.model("UserBadge", userBadgeSchema),
  userBadgeSchema,
};
