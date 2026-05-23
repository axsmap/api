const mongoose = require("mongoose");

// Badge definitions, admin-managed. Currently no seed data; the plumbing is
// here so the frontend can render `{ earned, inProgress }` once badges are
// defined (via direct DB inserts or a future admin UI).
const badgeSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, "Is required"],
      unique: true,
      maxlength: [80, "Should be less than 81 characters"],
    },
    name: { type: String, required: [true, "Is required"], maxlength: 120 },
    description: { type: String, required: [true, "Is required"], maxlength: 500 },
    iconUrl: { type: String, required: [true, "Is required"], maxlength: 2000 },
    category: {
      type: String,
      enum: ["achievement", "ranking"],
      required: [true, "Is required"],
    },
    scope: {
      type: String,
      enum: ["lifetime", "mapathon"],
      required: [true, "Is required"],
    },
    // Rule shape used by src/helpers/evaluate-badges.js.
    // Supported today:
    //   { type: "review_count", gte: <number> }
    // Future types (locked, currently no-op): "review_streak", "events_joined".
    rule: { type: mongoose.Schema.Types.Mixed, required: [true, "Is required"] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = {
  Badge: mongoose.model("Badge", badgeSchema),
  badgeSchema,
};
