const { getDb } = require('../events/leaderboard-helpers');
const { ObjectId } = require('mongodb');

module.exports = async (req, res, next) => {
  let invites;
  try {
    const db = await getDb();
    invites = await db
      .collection('invites')
      .find({ sender: new ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .limit(25)
      .project({
        _id: 1,
        channel: 1,
        contact: 1,
        createdAt: 1,
        deliveryState: 1
      })
      .toArray();
    invites = invites.map(invite => ({
      id: invite._id.toString(),
      channel: invite.channel,
      contact: invite.contact,
      createdAt: invite.createdAt,
      deliveryState: invite.deliveryState
    }));
  } catch (err) {
    console.log(`Invites for user ${req.user.id} failed to be found`);
    return next(err);
  }

  return res.status(200).json({ results: invites });
};
