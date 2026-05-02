const moment = require("moment");

const { User } = require("../../models/user");
const { Review } = require("../../models/review");

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function assignDenseRanking(rows) {
  let lastReviews = null;
  let rank = 0;
  return rows.map((row) => {
    if (row.reviewsAmount !== lastReviews) {
      rank += 1;
      lastReviews = row.reviewsAmount;
    }
    return { ...row, ranking: rank };
  });
}

function shapeUser(user) {
  return {
    id: user._id.toString(),
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    username: user.username || "",
    avatar: user.avatar || "",
  };
}

async function buildAllTime(limit) {
  const users = await User.find({ isArchived: false, reviewsAmount: { $gt: 0 } })
    .sort({ reviewsAmount: -1, createdAt: 1 })
    .limit(limit)
    .select("firstName lastName username avatar reviewsAmount")
    .lean();

  const rows = users.map((u) => ({
    ...shapeUser(u),
    reviewsAmount: u.reviewsAmount || 0,
  }));
  return assignDenseRanking(rows);
}

async function buildMonth(limit) {
  const startOfMonth = moment.utc().startOf("month").toDate();

  const aggregation = await Review.aggregate([
    { $match: { createdAt: { $gte: startOfMonth }, isBanned: { $ne: true } } },
    {
      $group: {
        _id: "$user",
        reviewsAmount: { $sum: 1 },
        firstReviewAt: { $min: "$createdAt" },
      },
    },
    { $match: { reviewsAmount: { $gt: 0 } } },
    { $sort: { reviewsAmount: -1, firstReviewAt: 1 } },
    { $limit: limit * 2 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: { "user.isArchived": { $ne: true } } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        id: { $toString: "$user._id" },
        firstName: { $ifNull: ["$user.firstName", ""] },
        lastName: { $ifNull: ["$user.lastName", ""] },
        username: { $ifNull: ["$user.username", ""] },
        avatar: { $ifNull: ["$user.avatar", ""] },
        reviewsAmount: 1,
      },
    },
  ]);

  return assignDenseRanking(aggregation);
}

module.exports = async (req, res, next) => {
  const period = req.query.period || "allTime";
  if (period !== "allTime" && period !== "month") {
    return res.status(400).json({ period: "Should be allTime or month" });
  }

  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit)) limit = 20;
  limit = Math.max(1, Math.min(100, limit));

  const cacheKey = `${period}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.set("Cache-Control", "public, max-age=60");
    return res.status(200).json(cached);
  }

  let results;
  try {
    results =
      period === "allTime" ? await buildAllTime(limit) : await buildMonth(limit);
  } catch (err) {
    console.log(`Leaderboard aggregation failed for period=${period}`);
    return next(err);
  }

  const payload = { period, results };
  cacheSet(cacheKey, payload);

  res.set("Cache-Control", "public, max-age=60");
  return res.status(200).json(payload);
};
