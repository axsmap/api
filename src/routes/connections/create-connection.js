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
      .select("blockedConnectionUserIds isArchived isBlocked")
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
