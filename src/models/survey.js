const mongoose = require("mongoose");

const surveySchema = new mongoose.Schema(
  {
    features: {
      type: String,
      required: [true, "Is required"],
    },
    navigationEase: {
      type: String,
      required: [true, "Is required"],
    },
    motivation: {
      type: String,
      required: [true, "Is required"],
    },
    accessibility: {
      type: String,
      required: [true, "Is required"],
    },
    additionalFeatures: {
      type: String,
      required: true,
    },
    satisfaction: {
      type: String,
      required: false,
    },
    challenges: {
      type: String,
      required: false,
    },
    recommend: {
      type: String,
      required: false,
    },
    frequency: {
      type: String,
      required: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
    },
  },
  { timestamps: true }
);

module.exports = {
  Survey: mongoose.model("Survey", surveySchema),
  surveySchema,
};
