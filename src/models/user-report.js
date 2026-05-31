const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
      index: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
      index: true,
    },
    type: {
      type: String,
      enum: ["harassment", "impersonation", "offensive", "spam", "unsafe", "other"],
      required: [true, "Is required"],
    },
    comments: { type: String, maxlength: 2000 },
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = {
  UserReport: mongoose.model("UserReport", userReportSchema),
  userReportSchema,
};
