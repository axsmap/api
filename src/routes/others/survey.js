const { Survey } = require("../../models/survey");

module.exports = async (req, res) => {
  const {
    features,
    navigationEase,
    motivation,
    accessibility,
    additionalFeatures,
    satisfaction,
    challenges,
    recommend,
    frequency,
  } = req.body;
  try {
    const surveyForm = new Survey({
      features,
      navigationEase,
      motivation,
      accessibility,
      additionalFeatures,
      satisfaction,
      challenges,
      recommend,
      frequency,
    });

    await surveyForm.save();

    res.status(201).json({ message: "Survey saved successfully." });
  } catch (error) {
    res.status(500).json({ error: "Something went wrong." });
  }
};
