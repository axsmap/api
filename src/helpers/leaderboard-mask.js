const mongoose = require("mongoose");

// Masked identity values returned for a user who has opted out of appearing
// by name on ranked/public surfaces (showNameOnLeaderboard === false).
const MASKED = {
  firstName: "Anonymous",
  lastName: "",
  username: null,
  avatar: null,
  email: null,
};

/**
 * Build the masking primitives for an aggregation $project stage.
 *
 * Masks a user's identity when showNameOnLeaderboard === false. Legacy docs
 * without the field default to visible (via $ifNull → true). The viewer is
 * exempt from masking when they are the user themselves (owner) or an admin —
 * those viewers always see the real identity.
 *
 * @param {{ viewerId?: string|null, viewerIsAdmin?: boolean }} opts
 * @returns {{ field: (realField: string, key: keyof MASKED) => any }}
 *   `field` returns the $project expression for one identity field.
 */
function buildAggregationMask(opts = {}) {
  const { viewerId, viewerIsAdmin } = opts;

  // Admins always see the real identity → no masking expression at all.
  if (viewerIsAdmin === true) {
    return { field: (realField) => `$${realField}` };
  }

  const optedOut = { $eq: [{ $ifNull: ["$showNameOnLeaderboard", true] }, false] };
  // When the viewer's id is known, exempt the owner viewing themselves.
  const notOwner = viewerId
    ? { $ne: ["$_id", new mongoose.Types.ObjectId(viewerId)] }
    : true;
  const shouldMask = { $and: [optedOut, notOwner] };

  return {
    field: (realField, key) => ({
      $cond: [shouldMask, MASKED[key], `$${realField}`],
    }),
  };
}

/**
 * JS-side masking for the leaderboard endpoint. Returns the row with an
 * `anonymous` boolean flag added (true when the user opted out — useful to
 * the client even when fields are NOT masked, e.g. admin view rendering a
 * subtle badge). Identity fields are masked only when:
 *   - the user opted out (`showNameOnLeaderboard === false`), AND
 *   - the viewer is not an admin.
 * Legacy docs without the field default to visible (undefined → true).
 *
 * @param {object} row              shaped row (id, firstName, lastName, username, avatar, reviewsAmount)
 * @param {boolean|undefined} showNameOnLeaderboard  raw field off the user doc
 * @param {{ viewerIsAdmin?: boolean }} [opts]
 */
function maskLeaderboardRow(row, showNameOnLeaderboard, opts = {}) {
  const anonymous = showNameOnLeaderboard === false;
  if (anonymous && opts.viewerIsAdmin !== true) {
    return {
      ...row,
      firstName: MASKED.firstName,
      lastName: MASKED.lastName,
      username: MASKED.username,
      avatar: MASKED.avatar,
      anonymous: true,
    };
  }
  return { ...row, anonymous };
}

module.exports = { MASKED, buildAggregationMask, maskLeaderboardRow };
