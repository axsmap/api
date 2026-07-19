const mongoose = require('mongoose');
const { BadgeDefinition } = require('../../models/badge-definition');
const { EarnedBadge } = require('../../models/earned-badge');
const { User } = require('../../models/user');
const {
  collectBadgeMetrics,
  progressForDefinition
} = require('../../services/badge-evaluator');

function definitionResponse(badge) {
  return {
    id: badge.badgeId,
    badgeId: badge.badgeId,
    name: badge.name,
    description: badge.description,
    category: badge.category,
    criteria: badge.criteria,
    threshold: badge.threshold,
    iconUrl: badge.iconUrl,
    displayOrder: badge.displayOrder,
    isActive: badge.isActive,
    level: badge.level,
    visibility: badge.visibility,
    metadata: badge.metadata,
    createdAt: badge.createdAt,
    updatedAt: badge.updatedAt
  };
}

module.exports = async function getUserBadges(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ general: 'Invalid user ID' });
  }
  try {
    const isOwner = req.user && String(req.user._id) === req.params.userId;
    const isAdmin = req.user && req.user.isAdmin;
    const user = await User.findById(req.params.userId)
      .select('profilePublic hideBadges isArchived isBlocked')
      .lean();
    if (!user || user.isArchived || user.isBlocked)
      return res.status(404).json({ general: 'User not found' });
    if (
      !isOwner &&
      !isAdmin &&
      (user.profilePublic === false || user.hideBadges === true)
    ) {
      return res.status(403).json({ general: 'Badges are private' });
    }
    const definitions = await BadgeDefinition.find({ isActive: true })
      .sort({ displayOrder: 1, badgeId: 1 })
      .lean();
    const earned = await EarnedBadge.find({ user: req.params.userId })
      .populate('badge')
      .sort({ earnedAt: -1 });
    const metrics = await collectBadgeMetrics(req.params.userId);
    const visibleEarned = earned.filter(
      item =>
        item.badge &&
        (isOwner || !item.visibility || item.visibility.public !== false)
    );
    const earnedDefinitionIds = new Set(
      visibleEarned.map(item => String(item.badge._id))
    );
    return res.json({
      definitions: definitions.map(definitionResponse),
      earned: visibleEarned.map(item => ({
        ...definitionResponse(item.badge),
        earnedId: String(item._id),
        awardedAt: item.earnedAt,
        earnedAt: item.earnedAt,
        earnedLevel: item.level,
        earnedVisibility: item.visibility,
        earnedMetadata: item.metadata,
        earnedCreatedAt: item.createdAt,
        earnedUpdatedAt: item.updatedAt
      })),
      inProgress: definitions
        .filter(item => !earnedDefinitionIds.has(String(item._id)))
        .map(item => {
          const progress = progressForDefinition(item, metrics);
          return {
            ...definitionResponse(item),
            progress: progress.value,
            progressSupported: progress.supported,
            progressUnavailableReason: progress.reason
          };
        })
    });
  } catch (error) {
    return next(error);
  }
};
