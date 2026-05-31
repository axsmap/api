const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { User } = require("../../models/user");
const { UserReport } = require("../../models/user-report");

const VALID_TYPES = new Set([
  "harassment",
  "impersonation",
  "offensive",
  "spam",
  "unsafe",
  "other",
]);

// POST /reports/users  { target, type, comments? }
module.exports = async (req, res, next) => {
  const { target, type } = req.body || {};
  const comments = (req.body && req.body.comments) || "";

  if (!target || !isMongoId(String(target))) {
    return res.status(400).json({ target: "Should be a valid id" });
  }
  if (String(target) === String(req.user.id)) {
    return res.status(400).json({ target: "Cannot report yourself" });
  }
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({
      type: "Should be one of: " + Array.from(VALID_TYPES).join(", "),
    });
  }
  if (typeof comments !== "string") {
    return res.status(400).json({ comments: "Should be a string" });
  }
  if (comments.length > 2000) {
    return res
      .status(400)
      .json({ comments: "Should be less than 2001 characters" });
  }

  const targetOid = new mongoose.Types.ObjectId(String(target));
  let targetUser;
  try {
    targetUser = await User.findById(targetOid).select("_id").lean();
  } catch (err) {
    return next(err);
  }
  if (!targetUser) {
    return res.status(404).json({ target: "User not found" });
  }

  let report;
  try {
    report = await UserReport.create({
      reporter: req.user.id,
      target: targetOid,
      type,
      comments,
      status: "open",
    });
  } catch (err) {
    console.log(`Report failed to be created by user ${req.user.id}`);
    return next(err);
  }

  return res.status(201).json({
    id: report._id.toString(),
    general: "Report submitted. Our team will review it shortly.",
  });
};
