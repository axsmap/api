const mongoose = require("mongoose");

const { Badge } = require("../../models/badge");
const { User } = require("../../models/user");
const { UserBadge } = require("../../models/user-badge");

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  let userOid;
  try {
    userOid = new mongoose.Types.ObjectId(userId);
  } catch (_) {
    return res.status(404).json({ general: "User not found" });
  }

  let user;
  try {
    user = await User.findOne({ _id: userOid })
      .select("isArchived isBlocked profilePublic hideBadges")
      .lean();
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ general: "User not found" });
    }
    console.log(`User ${userId} failed to be found at get-user-badges`);
    return next(err);
  }

  if (!user || user.isArchived || user.isBlocked) {
    return res.status(404).json({ general: "User not found" });
  }

  // Privacy gate — profile owner / admin can always see; otherwise respect
  // profilePublic + hideBadges.
  const requester = req.user || null;
  const isOwner = requester && requester.id === userId;
  const isAdmin = requester && requester.isAdmin;
  if (!isOwner && !isAdmin) {
    // Public by default — only an explicit opt-out (false) is private.
    if (user.profilePublic === false) {
      return res.status(403).json({ general: "Profile is private" });
    }
    if (user.hideBadges) {
      return res.status(200).json({ earned: [], inProgress: [] });
    }
  }

  let awards;
  try {
    awards = await UserBadge.find({ user: userOid, isSuppressed: false })
      .populate("badge")
      .lean();
  } catch (err) {
    console.log(`Awards lookup failed at get-user-badges for user ${userId}`);
    return next(err);
  }

  const earned = [];
  const inProgress = [];

  for (const a of awards) {
    if (!a.badge || a.badge.isActive === false) continue;
    const entry = {
      id: a._id.toString(),
      slug: a.badge.slug,
      name: a.badge.name,
      description: a.badge.description,
      iconUrl: a.badge.iconUrl,
      category: a.badge.category,
      scope: a.badge.scope,
      event: a.event ? a.event.toString() : null,
      awardedAt: a.awardedAt,
      progress: a.progress,
    };
    if (a.progress >= 1) {
      earned.push(entry);
    } else {
      inProgress.push(entry);
    }
  }

  return res.status(200).json({ earned, inProgress });
};
