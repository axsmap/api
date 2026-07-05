const mongoose = require("mongoose");

const { Connection } = require("../../models/connection");
const { User } = require("../../models/user");
const { Event } = require("../../models/event");
const { maskUserIdentity } = require("../../helpers/leaderboard-mask");

const STATES = new Set(["pending", "accepted", "declined", "all"]);
const USER_FIELDS = "avatar firstName lastName username publicVisibility";

// GET /connections?state=pending|accepted|declined|all
module.exports = async (req, res, next) => {
  const state = (req.query.state || "all").toString();
  if (!STATES.has(state)) {
    return res
      .status(400)
      .json({ state: "Should be pending, accepted, declined, or all" });
  }

  const userId = new mongoose.Types.ObjectId(req.user.id);
  const viewer = {
    viewerId: req.user.id,
    viewerIsAdmin: !!(req.user && req.user.isAdmin === true),
  };
  // Mask a peer who chose publicVisibility="anonymous". Owner-exemption means
  // the viewer always sees their own entry unmasked.
  const shapeParty = (u) =>
    u
      ? maskUserIdentity(
          {
            id: u._id.toString(),
            avatar: u.avatar,
            firstName: u.firstName,
            lastName: u.lastName,
            username: u.username,
          },
          u.publicVisibility,
          viewer
        )
      : null;

  const filter = {
    $or: [{ requester: userId }, { recipient: userId }],
  };
  if (state !== "all") filter.state = state;

  let connections;
  try {
    connections = await Connection.find(filter)
      .sort({ updatedAt: -1 })
      .populate("requester", USER_FIELDS)
      .populate("recipient", USER_FIELDS)
      .populate("originEvent", "name startDate endDate")
      .lean();
  } catch (err) {
    console.log(`Connections lookup failed for user ${req.user.id}`);
    return next(err);
  }

  // sharedEvents = events both users participated in (inner join via
  // Event.participants). Computed once per connection — cheap relative to
  // the rest of the page.
  const results = await Promise.all(
    connections.map(async (c) => {
      const a = c.requester && c.requester._id;
      const b = c.recipient && c.recipient._id;
      let sharedEvents = [];
      if (a && b) {
        try {
          sharedEvents = await Event.find({
            participants: { $all: [a, b] },
            isArchived: false,
          })
            .sort({ startDate: -1 })
            .select("name startDate endDate")
            .limit(5)
            .lean();
        } catch (err) {
          console.log(`sharedEvents lookup failed for connection ${c._id}`);
        }
      }
      return {
        id: c._id.toString(),
        state: c.state,
        requester: shapeParty(c.requester),
        recipient: shapeParty(c.recipient),
        originEvent: c.originEvent
          ? {
              id: c.originEvent._id.toString(),
              name: c.originEvent.name,
              startDate: c.originEvent.startDate,
              endDate: c.originEvent.endDate,
            }
          : null,
        sharedEvents: sharedEvents.map((e) => ({
          id: e._id.toString(),
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate,
        })),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    })
  );

  // Strip rows where either party has the other blocked. The spec says
  // blocking must hide both directions from /connections.
  let me;
  try {
    me = await User.findById(req.user.id)
      .select("blockedConnectionUserIds")
      .lean();
  } catch (err) {
    return next(err);
  }
  const myBlocks = new Set(
    (me && me.blockedConnectionUserIds ? me.blockedConnectionUserIds : []).map(
      (id) => id.toString()
    )
  );

  // For each row, also check if the OTHER party has me blocked.
  const otherUserIds = Array.from(
    new Set(
      results
        .map((r) => (r.requester && r.recipient ? (r.requester.id === req.user.id ? r.recipient.id : r.requester.id) : null))
        .filter(Boolean)
    )
  );
  let othersBlockingMe = new Set();
  if (otherUserIds.length > 0) {
    try {
      const rows = await User.find({
        _id: { $in: otherUserIds },
        blockedConnectionUserIds: userId,
      })
        .select("_id")
        .lean();
      othersBlockingMe = new Set(rows.map((r) => r._id.toString()));
    } catch (err) {
      console.log(`Reverse-block lookup failed for user ${req.user.id}`);
    }
  }

  const filtered = results.filter((r) => {
    if (!r.requester || !r.recipient) return false;
    const otherId =
      r.requester.id === req.user.id ? r.recipient.id : r.requester.id;
    if (myBlocks.has(otherId)) return false;
    if (othersBlockingMe.has(otherId)) return false;
    return true;
  });

  return res.status(200).json({ results: filtered });
};
