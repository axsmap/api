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
      required: [true, "Is required"],
    },
    satisfaction: {
      type: String,
      required: [true, "Is required"],
    },
    challenges: {
      type: String,
      required: [true, "Is required"],
    },
    recommend: {
      type: String,
      required: [true, "Is required"],
    },
    frequency: {
      type: String,
      required: [true, "Is required"],
    },
  },
  { timestamps: true }
);

module.exports = {
  Survey: mongoose.model("Survey", surveySchema),
  surveySchema,
};
