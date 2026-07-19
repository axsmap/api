const mongoose = require('mongoose');

const { BadgeDefinition } = require('../models/badge-definition');
const { EarnedBadge } = require('../models/earned-badge');
const { Event } = require('../models/event');
const { Review } = require('../models/review');
const { User } = require('../models/user');

async function collectBadgeMetrics(userId) {
  const objectId = mongoose.Types.ObjectId(userId);
  const [
    user,
    approvedReviews,
    categoryRows,
    geographyRows,
    mapathons,
    fundraisers
  ] = await Promise.all([
    User.findById(objectId)
      .select('_id')
      .lean(),
    Review.countDocuments({ user: objectId, isBanned: false }),
    Review.aggregate([
      { $match: { user: objectId, isBanned: false } },
      {
        $lookup: {
          from: 'venues',
          localField: 'venue',
          foreignField: '_id',
          as: 'venue'
        }
      },
      { $unwind: '$venue' },
      { $unwind: '$venue.types' },
      { $group: { _id: '$venue.types', count: { $sum: 1 } } }
    ]),
    Review.aggregate([
      { $match: { user: objectId, isBanned: false } },
      {
        $lookup: {
          from: 'venues',
          localField: 'venue',
          foreignField: '_id',
          as: 'venue'
        }
      },
      { $unwind: '$venue' },
      {
        $group: {
          _id: null,
          countries: { $addToSet: '$venue.countryCode' },
          missingCountries: {
            $sum: { $cond: [{ $ifNull: ['$venue.countryCode', false] }, 0, 1] }
          }
        }
      }
    ]),
    Event.countDocuments({
      isArchived: false,
      $or: [{ managers: objectId }, { participants: objectId }]
    }),
    Event.countDocuments({
      isArchived: false,
      donationEnabled: true,
      $or: [{ managers: objectId }, { participants: objectId }]
    })
  ]);
  if (!user) return null;
  const geography = geographyRows[0] || { countries: [], missingCountries: 0 };
  return {
    approvedReviews,
    categoryReviews: categoryRows.reduce((result, row) => {
      result[row._id] = row.count;
      return result;
    }, {}),
    countries: geography.countries.filter(Boolean),
    geographicDataComplete: geography.missingCountries === 0,
    mapathons,
    fundraisers
  };
}

function progressForDefinition(definition, metrics) {
  const criteria = definition.criteria || {};
  switch (criteria.type) {
    case 'approved_reviews':
      return { supported: true, value: metrics.approvedReviews };
    case 'category_review':
      return {
        supported: true,
        value: (criteria.googlePlaceTypes || []).reduce(
          (total, type) => total + (metrics.categoryReviews[type] || 0),
          0
        )
      };
    case 'mapathon_participation':
      return { supported: true, value: metrics.mapathons };
    case 'fundraiser_participation':
      return { supported: true, value: metrics.fundraisers };
    case 'geographic_review':
      return metrics.geographicDataComplete
        ? { supported: true, value: metrics.countries.length }
        : {
            supported: false,
            value: null,
            reason:
              'One or more reviewed venues do not have an authoritative countryCode'
          };
    default:
      return {
        supported: false,
        value: null,
        reason: `Unsupported criteria type: ${criteria.type}`
      };
  }
}

async function evaluateUserBadges(userId, options = {}) {
  const metrics = await collectBadgeMetrics(userId);
  if (!metrics)
    return {
      userId: String(userId),
      missingUser: true,
      awarded: [],
      unsupported: []
    };
  const definitions = await BadgeDefinition.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .lean();
  const existingEarned = options.revokeUnearned
    ? await EarnedBadge.find({ user: userId })
        .select('badge')
        .lean()
    : [];
  const existingBadgeIds = new Set(
    existingEarned.map(item => String(item.badge))
  );
  const awarded = [];
  const revoked = [];
  const unsupported = [];
  for (const definition of definitions) {
    const progress = progressForDefinition(definition, metrics);
    if (!progress.supported) {
      unsupported.push({
        badgeId: definition.badgeId,
        reason: progress.reason
      });
      continue;
    }
    if (progress.value < (definition.threshold || 0)) {
      if (
        options.revokeUnearned &&
        existingBadgeIds.has(String(definition._id))
      ) {
        const result = await EarnedBadge.deleteOne({
          user: userId,
          badge: definition._id
        });
        if (result.deletedCount || result.n) revoked.push(definition.badgeId);
      }
      continue;
    }
    if (existingBadgeIds.has(String(definition._id))) continue;
    const result = await EarnedBadge.updateOne(
      { user: userId, badge: definition._id },
      {
        $setOnInsert: {
          user: userId,
          badge: definition._id,
          earnedAt: new Date(),
          level: definition.level,
          visibility: definition.visibility,
          metadata: { criteriaValue: progress.value }
        }
      },
      { upsert: true }
    );
    if (result.upserted || result.upsertedId) awarded.push(definition.badgeId);
  }
  return { userId: String(userId), awarded, revoked, unsupported, metrics };
}

module.exports = {
  collectBadgeMetrics,
  evaluateUserBadges,
  progressForDefinition
};
