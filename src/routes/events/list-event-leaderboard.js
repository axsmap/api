const mongoose = require("mongoose");
const { isInt, isMongoId } = require("validator");

const { Event } = require("../../models/event");
const { Review } = require("../../models/review");
const { maskLeaderboardRow } = require("../../helpers/leaderboard-mask");

const MAX_LEADERBOARD_USERS = 5;
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

module.exports = async (req, res, next) => {
  const queryParams = req.query;
  let eventId = req.params.eventId;

  if (!isMongoId(eventId)) {
    return res.status(400).json({ general: "Event not found" });
  }

  const errors = {};
  if (queryParams.limit !== undefined) {
    if (!isInt(String(queryParams.limit))) {
      errors.limit = "Should be a integer";
    } else if (parseInt(queryParams.limit, 10) < 1) {
      errors.limit = "Should be greater than or equal to 1";
    } else if (parseInt(queryParams.limit, 10) > MAX_LEADERBOARD_USERS) {
      errors.limit = `Should be less than or equal to ${MAX_LEADERBOARD_USERS}`;
    }
  }
  if (Object.keys(errors).length) return res.status(400).json(errors);

  const pageLimit = queryParams.limit
    ? parseInt(queryParams.limit, 10)
    : MAX_LEADERBOARD_USERS;

  // Admins see real names; everyone else sees masked rows for opted-out users.
  const viewerIsAdmin = req.user?.isAdmin === true;
  const cacheKey = `${eventId}:${pageLimit}:${viewerIsAdmin ? "admin" : "public"}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.set("Cache-Control", "private, max-age=60");
    return res.status(200).json(cached);
  }

  const eventObjectId = new mongoose.Types.ObjectId(eventId);

  let event;
  try {
    event = await Event.findOne({ _id: eventObjectId, isArchived: false })
      .select("_id")
      .lean();
  } catch (err) {
    console.log(`Event ${eventId} failed to be found at list-event-leaderboard`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: "Event not found" });
  }

  let users;
  let total;
  try {
    const leaderboardPipeline = [
      {
        $match: {
          event: eventObjectId,
          isBanned: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$user",
          reviewsAmount: { $sum: 1 },
        },
      },
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
        // NOTE: do NOT exclude admins here. Admins (e.g. the founder) are real
        // contributors and appear on the global leaderboard; excluding them from
        // per-mapathon leaderboards is inconsistent and renders an empty board
        // for any Mapathon whose reviewers happen to be admins. Only brand/bot
        // (isSystemAccount), archived, and blocked accounts are excluded.
        $match: {
          "user.isArchived": { $ne: true },
          "user.isBlocked": { $ne: true },
          "user.isSystemAccount": { $ne: true },
        },
      },
      { $sort: { reviewsAmount: -1, "user.createdAt": 1 } },
    ];

    const facetResults = await Review.aggregate([
      ...leaderboardPipeline,
      {
        $facet: {
          results: [
            { $limit: pageLimit },
            {
              $project: {
                _id: 0,
                id: { $toString: "$user._id" },
                avatar: { $ifNull: ["$user.avatar", ""] },
                firstName: { $ifNull: ["$user.firstName", ""] },
                lastName: { $ifNull: ["$user.lastName", ""] },
                username: { $ifNull: ["$user.username", ""] },
                reviewsAmount: 1,
                showNameOnLeaderboard: {
                  $ifNull: ["$user.showNameOnLeaderboard", true],
                },
                profilePublic: { $ifNull: ["$user.profilePublic", true] },
              },
            },
          ],
          total: [{ $count: "value" }],
        },
      },
    ]);

    const facet = facetResults[0] || { results: [], total: [] };
    users = facet.results;
    total = facet.total.length ? facet.total[0].value : 0;
  } catch (err) {
    console.log("Event leaderboard users failed to be found or count");
    return next(err);
  }

  const results = users.map((user, index) => {
    const { showNameOnLeaderboard, ...rest } = user;
    return {
      ...maskLeaderboardRow(rest, showNameOnLeaderboard, { viewerIsAdmin }),
      ranking: index + 1,
    };
  });

  const payload = {
    page: results.length ? 1 : null,
    lastPage: results.length ? 1 : null,
    pageLimit,
    total,
    results,
  };

  cacheSet(cacheKey, payload);
  res.set("Cache-Control", "private, max-age=60");
  return res.status(200).json(payload);
};
