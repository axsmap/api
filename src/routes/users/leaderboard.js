const moment = require("moment");

const { User } = require("../../models/user");
const { Review } = require("../../models/review");
const { maskUserIdentity } = require("../../helpers/leaderboard-mask");

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
    displayName: user.displayName || null,
    username: user.username || "",
    avatar: user.avatar || "",
    // Frontend disables the row link when false (private profile not clickable).
    // Public by default — only an explicit false is private.
    profilePublic: user.profilePublic !== false,
  };
}

async function buildAllTime(limit, opts = {}) {
  const users = await User.find({
    isArchived: false,
    isSystemAccount: { $ne: true },
    reviewsAmount: { $gt: 0 },
  })
    .sort({ reviewsAmount: -1, createdAt: 1 })
    .limit(limit)
    .select("firstName lastName displayName username avatar reviewsAmount publicVisibility profilePublic")
    .lean();

  const rows = users.map((u) =>
    maskUserIdentity(
      { ...shapeUser(u), reviewsAmount: u.reviewsAmount || 0 },
      u.publicVisibility,
      opts
    )
  );
  return assignDenseRanking(rows);
}

async function buildMonth(limit, opts = {}) {
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
    {
      $match: {
        "user.isArchived": { $ne: true },
        "user.isSystemAccount": { $ne: true },
      },
    },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        id: { $toString: "$user._id" },
        firstName: { $ifNull: ["$user.firstName", ""] },
        lastName: { $ifNull: ["$user.lastName", ""] },
        displayName: { $ifNull: ["$user.displayName", null] },
        username: { $ifNull: ["$user.username", ""] },
        avatar: { $ifNull: ["$user.avatar", ""] },
        reviewsAmount: 1,
        publicVisibility: { $ifNull: ["$user.publicVisibility", "displayName"] },
        profilePublic: { $ifNull: ["$user.profilePublic", true] },
      },
    },
  ]);

  const masked = aggregation.map((row) => {
    const { publicVisibility, ...rest } = row;
    return maskUserIdentity(rest, publicVisibility, opts);
  });
  return assignDenseRanking(masked);
}

module.exports = async (req, res, next) => {
  const period = req.query.period || "allTime";
  if (period !== "allTime" && period !== "month") {
    return res.status(400).json({ period: "Should be allTime or month" });
  }

  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit)) limit = 20;
  limit = Math.max(1, Math.min(100, limit));

  // Admins see the unmasked leaderboard (real names + an `anonymous: true`
  // flag for opted-out users). Cache the admin and public variants separately
  // — admin views are rare so this only adds one extra cache entry per
  // (period, limit) pair, and we never risk handing the unmasked payload
  // to a non-admin viewer who happened to hit a warm cache.
  const viewerIsAdmin = req.user?.isAdmin === true;
  const cacheKey = `${period}:${limit}:${viewerIsAdmin ? "admin" : "public"}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.set("Cache-Control", "private, max-age=60");
    return res.status(200).json(cached);
  }

  let results;
  try {
    results =
      period === "allTime"
        ? await buildAllTime(limit, { viewerIsAdmin })
        : await buildMonth(limit, { viewerIsAdmin });
  } catch (err) {
    console.log(`Leaderboard aggregation failed for period=${period}`);
    return next(err);
  }

  const payload = { period, results };
  cacheSet(cacheKey, payload);

  // `private` (not `public`) because the admin variant must never be stored
  // by a shared HTTP cache. Both variants are personalized in that sense.
  res.set("Cache-Control", "private, max-age=60");
  return res.status(200).json(payload);
};
