const mongoose = require("mongoose");

// Values substituted for a user whose publicVisibility === "anonymous".
const MASKED = {
  firstName: "Anonymous",
  lastName: "",
  displayName: null,
  username: null,
  avatar: null,
  email: null,
};

/**
 * Build masking primitives for an aggregation $project stage where the USER is
 * the root document (get-user, list-users). Masks identity when
 * publicVisibility === "anonymous"; legacy docs without the field default to
 * "displayName" (visible). Owner (viewer === this user) and admins are exempt.
 *
 * @param {{ viewerId?: string|null, viewerIsAdmin?: boolean }} opts
 * @returns {{ field: (realField: string, key: keyof MASKED) => any, anonymousExpr: object }}
 */
function buildAggregationMask(opts = {}) {
  const { viewerId, viewerIsAdmin } = opts;
  const anonymousExpr = {
    $eq: [{ $ifNull: ["$publicVisibility", "displayName"] }, "anonymous"],
  };

  // Admins always see the real identity → no masking expression at all.
  if (viewerIsAdmin === true) {
    return { field: (realField) => `$${realField}`, anonymousExpr };
  }

  // When the viewer's id is known, exempt the owner viewing themselves.
  const notOwner = viewerId
    ? { $ne: ["$_id", new mongoose.Types.ObjectId(viewerId)] }
    : true;
  const shouldMask = { $and: [anonymousExpr, notOwner] };

  return {
    field: (realField, key) => ({
      $cond: [shouldMask, MASKED[key], `$${realField}`],
    }),
    anonymousExpr,
  };
}

/**
 * JS-side identity masking for any shaped row that carries `id` + identity
 * fields. Used by the leaderboard endpoints and every other surface that
 * returns a user reference for public display (venue review authors, team
 * members, event participants/managers, connections, etc.).
 *
 * Masks firstName/lastName/username/avatar when the user is anonymous
 * (publicVisibility === "anonymous"), UNLESS the viewer is that same user
 * (owner) or an admin. Always attaches an `anonymous` boolean so admin/client
 * UIs can badge opted-out users even when their identity is shown.
 *
 * @param {object} row  shaped row containing at least { id }
 * @param {string|undefined} publicVisibility  raw field off the user doc
 * @param {{ viewerId?: string|null, viewerIsAdmin?: boolean }} [opts]
 */
function maskUserIdentity(row, publicVisibility, opts = {}) {
  const anonymous = publicVisibility === "anonymous";
  const isOwner =
    opts.viewerId && row && String(opts.viewerId) === String(row.id);
  if (anonymous && opts.viewerIsAdmin !== true && !isOwner) {
    return {
      ...row,
      firstName: MASKED.firstName,
      lastName: MASKED.lastName,
      displayName: MASKED.displayName,
      username: MASKED.username,
      avatar: MASKED.avatar,
      anonymous: true,
    };
  }
  return { ...row, anonymous };
}

module.exports = { MASKED, buildAggregationMask, maskUserIdentity };
