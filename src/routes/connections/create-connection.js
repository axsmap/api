const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { Connection } = require("../../models/connection");
const { Event } = require("../../models/event");
const { User } = require("../../models/user");

// POST /connections    { eventId, userId }
// Idempotent: if a connection already exists between the pair, return it
// (with `general` text the frontend can surface as a toast).
module.exports = async (req, res, next) => {
  const { eventId, userId } = req.body || {};

  if (!userId || !isMongoId(String(userId))) {
    return res.status(400).json({ userId: "Should be a valid id" });
  }
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ userId: "Cannot connect with yourself" });
  }
  if (eventId && !isMongoId(String(eventId))) {
    return res.status(400).json({ eventId: "Should be a valid id" });
  }

  const requesterOid = new mongoose.Types.ObjectId(req.user.id);
  const recipientOid = new mongoose.Types.ObjectId(String(userId));
  const eventOid = eventId ? new mongoose.Types.ObjectId(String(eventId)) : null;

  // Mutual block check — block in either direction blocks the connect path.
  const [me, them] = await Promise.all([
    User.findById(requesterOid).select("blockedConnectionUserIds").lean(),
    User.findById(recipientOid)
      .select("blockedConnectionUserIds isArchived isBlocked connectionPreference")
      .lean(),
  ]);
  if (!them || them.isArchived || them.isBlocked) {
    return res.status(404).json({ general: "User not found" });
  }
  const iBlockedThem = (me && me.blockedConnectionUserIds ? me.blockedConnectionUserIds : []).some(
    (id) => id.toString() === recipientOid.toString()
  );
  const theyBlockedMe = (them.blockedConnectionUserIds || []).some(
    (id) => id.toString() === requesterOid.toString()
  );
  if (iBlockedThem || theyBlockedMe) {
    return res.status(403).json({ general: "Cannot connect with this user" });
  }

  // Idempotent existence check (matches either ordering).
  let existing;
  try {
    existing = await Connection.findOne({
      $or: [
        { requester: requesterOid, recipient: recipientOid },
        { requester: recipientOid, recipient: requesterOid },
      ],
    }).lean();
  } catch (err) {
    return next(err);
  }

  if (existing) {
    return res.status(200).json({
      id: existing._id.toString(),
      state: existing.state,
      general:
        existing.state === "accepted"
          ? "Already connected"
          : existing.state === "pending"
            ? "Connection request already pending"
            : "Connection exists",
    });
  }

  // Enforce the RECIPIENT's connectionPreference for NEW requests (existing
  // pairs already returned above, idempotently). All rejections are 403 with a
  // human `general` message the client toasts; the "none" case also returns a
  // machine-readable `connectionPreference` discriminator.
  const preference = them.connectionPreference || "mapathon";

  if (preference === "none") {
    return res.status(403).json({
      general: "This user isn't accepting connection requests.",
      connectionPreference: "none",
    });
  }

  if (preference === "mutual") {
    // Allowed only if requester and recipient already share an accepted
    // connection (friend-of-a-friend).
    let mutual = false;
    try {
      const reqConns = await Connection.find({
        state: "accepted",
        $or: [{ requester: requesterOid }, { recipient: requesterOid }],
      })
        .select("requester recipient")
        .lean();
      const reqFriendIds = new Set(
        reqConns.map((c) =>
          c.requester.toString() === requesterOid.toString()
            ? c.recipient.toString()
            : c.requester.toString()
        )
      );
      if (reqFriendIds.size > 0) {
        const recConns = await Connection.find({
          state: "accepted",
          $or: [{ requester: recipientOid }, { recipient: recipientOid }],
        })
          .select("requester recipient")
          .lean();
        mutual = recConns.some((c) => {
          const other =
            c.requester.toString() === recipientOid.toString()
              ? c.recipient.toString()
              : c.requester.toString();
          return reqFriendIds.has(other);
        });
      }
    } catch (err) {
      return next(err);
    }
    if (!mutual) {
      return res.status(403).json({
        general:
          "You can only connect with people you already share a connection with.",
      });
    }
  } else {
    // "mapathon" (default) — requester and recipient must share at least one
    // non-archived Mapathon (as participant or manager).
    let sharedEvent;
    try {
      sharedEvent = await Event.findOne({
        isArchived: false,
        $and: [
          { $or: [{ participants: requesterOid }, { managers: requesterOid }] },
          { $or: [{ participants: recipientOid }, { managers: recipientOid }] },
        ],
      })
        .select("_id")
        .lean();
    } catch (err) {
      return next(err);
    }
    if (!sharedEvent) {
      return res.status(403).json({
        general: "You can only connect with people from your Mapathons.",
      });
    }
  }

  // If an eventId is supplied, optionally validate it exists. Failing this
  // shouldn't block the connection — fall back to no originEvent.
  let resolvedEvent = null;
  if (eventOid) {
    try {
      const ev = await Event.findOne({ _id: eventOid, isArchived: false })
        .select("_id")
        .lean();
      if (ev) resolvedEvent = ev._id;
    } catch (_) {
      // ignore — just don't set originEvent
    }
  }

  let connection;
  try {
    connection = await Connection.create({
      requester: requesterOid,
      recipient: recipientOid,
      state: "pending",
      originEvent: resolvedEvent,
    });
  } catch (err) {
    if (err && err.code === "DUPLICATE_CONNECTION") {
      return res.status(200).json({
        id: err.existing._id.toString(),
        state: err.existing.state,
        general: "Connection already exists",
      });
    }
    console.log(
      `Connection failed to be created from ${req.user.id} to ${userId}`
    );
    return next(err);
  }

  return res.status(201).json({
    id: connection._id.toString(),
    state: connection.state,
    general: "Connection request sent",
  });
};
