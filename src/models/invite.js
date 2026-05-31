const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema(
  {
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "phone"],
      required: [true, "Is required"],
    },
    contact: {
      type: String,
      required: [true, "Is required"],
      maxlength: 254,
    },
    inviteUrl: { type: String, maxlength: 2000 },
    deliveryState: {
      type: String,
      enum: ["recorded", "sent", "failed"],
      default: "recorded",
    },
  },
  { timestamps: true }
);

inviteSchema.index({ inviter: 1, createdAt: -1 });

module.exports = {
  Invite: mongoose.model("Invite", inviteSchema),
  inviteSchema,
};
