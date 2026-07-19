const mongoose = require('mongoose');

const earnedBadgeSchema = new mongoose.Schema(
  {
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BadgeDefinition',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    earnedAt: { type: Date, required: true },
    level: String,
    visibility: {
      type: mongoose.Schema.Types.Mixed,
      default: { public: true }
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, minimize: false }
);

earnedBadgeSchema.index({ badge: 1, user: 1 }, { unique: true });

module.exports = {
  EarnedBadge: mongoose.model('EarnedBadge', earnedBadgeSchema),
  earnedBadgeSchema
};
