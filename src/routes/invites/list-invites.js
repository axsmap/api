const { Invite } = require("../../models/invite");

// GET /invites  — newest 20 of req.user's own invites.
module.exports = async (req, res, next) => {
  let invites;
  try {
    invites = await Invite.find({ inviter: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  } catch (err) {
    console.log(`Invite lookup failed for user ${req.user.id}`);
    return next(err);
  }

  const results = invites.map((i) => ({
    id: i._id.toString(),
    channel: i.channel,
    contact: i.contact,
    inviteUrl: i.inviteUrl || "",
    deliveryState: i.deliveryState,
    createdAt: i.createdAt,
  }));

  return res.status(200).json({ results });
};
