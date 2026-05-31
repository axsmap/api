const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { Connection } = require("../../models/connection");
const { User } = require("../../models/user");

// PUT /users/:id/block-connection
// Adds :id to req.user.blockedConnectionUserIds and tears down any existing
// connection between the pair. Idempotent.
module.exports = async (req, res, next) => {
  const targetId = req.params.id;
  if (!isMongoId(targetId)) {
    return res.status(404).json({ general: "User not found" });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ general: "Cannot block yourself" });
  }

  const targetOid = new mongoose.Types.ObjectId(targetId);
  const meOid = new mongoose.Types.ObjectId(req.user.id);

  let target;
  try {
    target = await User.findById(targetOid).select("_id").lean();
  } catch (err) {
    return next(err);
  }
  if (!target) {
    return res.status(404).json({ general: "User not found" });
  }

  try {
    await User.findByIdAndUpdate(meOid, {
      $addToSet: { blockedConnectionUserIds: targetOid },
    });
  } catch (err) {
    console.log(`Failed to add ${targetId} to blocks for user ${req.user.id}`);
    return next(err);
  }

  // Delete any existing connection between the pair so the row disappears
  // from /connections immediately. Frontend invalidates its cache after.
  try {
    await Connection.deleteMany({
      $or: [
        { requester: meOid, recipient: targetOid },
        { requester: targetOid, recipient: meOid },
      ],
    });
  } catch (err) {
    console.log(`Failed to clean up connection after block for ${req.user.id}`);
    // Non-fatal — block itself succeeded.
  }

  return res.status(200).json({ general: "Blocked" });
};
