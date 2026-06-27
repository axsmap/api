const crypto = require("crypto");

const { Event } = require("../../models/event");

module.exports = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ _id: eventId, isArchived: false });

    if (!event) {
      return res.status(404).json({ general: "Mapathon not found" });
    }

    const isManager = event.managers.some(
      (manager) => manager.toString() === req.user.id
    );

    if (!isManager) {
      return res.status(403).json({
        general: "Only organizers can share invite links",
      });
    }

    if (!event.joinCode) {
      event.joinCode = crypto.randomBytes(18).toString("hex");
      await event.save();
    }

    return res.status(200).json({ inviteCode: event.joinCode });
  } catch (error) {
    next(error);
  }
};
