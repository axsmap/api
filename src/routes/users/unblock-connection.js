const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { User } = require("../../models/user");

// PUT /users/:id/unblock-connection
// Removes :id from req.user.blockedConnectionUserIds. Idempotent.
module.exports = async (req, res, next) => {
  const targetId = req.params.id;
  if (!isMongoId(targetId)) {
    return res.status(404).json({ general: "User not found" });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ general: "Cannot unblock yourself" });
  }

  const targetOid = new mongoose.Types.ObjectId(targetId);

  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { blockedConnectionUserIds: targetOid },
    });
  } catch (err) {
    console.log(
      `Failed to remove ${targetId} from blocks for user ${req.user.id}`
    );
    return next(err);
  }

  return res.status(200).json({ general: "Unblocked" });
};
