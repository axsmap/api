const { Survey } = require("../../models/survey");
const {
  adminServeyMailTemplate,
  submitServeyUserMailTemplate,
} = require("../../helpers/mail-template");
const {  sendEmail } = require("../../helpers");

const questions = {
  features: "What features do you use most on AXS Map?",
  navigationEase: "How easy is it to navigate the app?",
  motivation: "What motivates you to participate in Mapathons?",
  accessibility: "How can we improve accessibility ratings?",
  additionalFeatures: "Any additional features you'd like to see?",
  satisfaction: "How satisfied are you with the app?",
  challenges: "What challenges have you faced using AXS Map?",
  recommend: "Would you recommend it to others?",
  frequency: "What would make you use it more often?",
};

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
      user: req?.user?.id,
    });

    await surveyForm.save();
    sendEmail({
      subject: "Survey Submission Confirmation",
      htmlContent: submitServeyUserMailTemplate(
        `${req?.user?.firstName ?? ""} ${req?.user?.lastName ?? ""}`
      ),
      textContent: "",
      receiversEmails: [req?.user?.email],
    });
    const aswers = [
      { question: questions.features, answer: features },
      { question: questions.navigationEase, answer: navigationEase },
      { question: questions.motivation, answer: motivation },
      { question: questions.accessibility, answer: accessibility },
      { question: questions.additionalFeatures, answer: additionalFeatures },
      { question: questions.satisfaction, answer: satisfaction },
      { question: questions.challenges, answer: challenges },
      { question: questions.recommend, answer: recommend },
      { question: questions.frequency, answer: frequency },
    ];
    sendEmail({
      subject: "Survey Submission Confirmation",
      htmlContent: adminServeyMailTemplate(
        `${req?.user?.firstName ?? ""} ${req?.user?.lastName ?? ""}`,
        req?.user?.email,
        aswers
      ),
      textContent: "",
      receiversEmails: [`${process?.env?.SERVEY_SUBMISSION_MAIL}`],
    });

    res.status(201).json({ message: "Survey saved successfully." });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Something went wrong." });
  }
};
