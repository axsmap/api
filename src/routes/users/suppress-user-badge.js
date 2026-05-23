const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { UserBadge } = require("../../models/user-badge");

// POST /users/:userId/badges/:badgeId/suppress
// Admin-only. Hides a badge award from public view without deleting it
// (preserves audit trail). To un-suppress, pass body { isSuppressed: false }.
module.exports = async (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ general: "Forbidden" });
  }

  const { userId, badgeId } = req.params;
  if (!isMongoId(userId) || !isMongoId(badgeId)) {
    return res.status(400).json({ general: "Invalid parameters" });
  }

  const isSuppressed =
    typeof req.body.isSuppressed === "boolean" ? req.body.isSuppressed : true;

  let award;
  try {
    award = await UserBadge.findOneAndUpdate(
      {
        user: new mongoose.Types.ObjectId(userId),
        badge: new mongoose.Types.ObjectId(badgeId),
      },
      { $set: { isSuppressed } },
      { new: true }
    );
  } catch (err) {
    console.log(`Suppress UserBadge failed for user=${userId} badge=${badgeId}`);
    return next(err);
  }

  if (!award) {
    return res.status(404).json({ general: "Award not found" });
  }

  console.log(
    `[badge] suppress ${isSuppressed ? "ON" : "OFF"} by admin=${req.user.id} for user=${userId} badge=${badgeId}`
  );

  return res.status(200).json({
    id: award._id,
    user: award.user,
    badge: award.badge,
    isSuppressed: award.isSuppressed,
  });
};
