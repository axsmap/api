const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { Connection } = require("../../models/connection");

const VALID_STATES = new Set(["accepted", "declined"]);

// PUT /connections/:id  { state: "accepted" | "declined" }
// Only the recipient of the pending request can call this.
module.exports = async (req, res, next) => {
  const id = req.params.id;
  if (!isMongoId(id)) {
    return res.status(404).json({ general: "Connection not found" });
  }

  const state = req.body && req.body.state;
  if (!VALID_STATES.has(state)) {
    return res.status(400).json({ state: "Should be accepted or declined" });
  }

  let connection;
  try {
    connection = await Connection.findById(new mongoose.Types.ObjectId(id));
  } catch (err) {
    return next(err);
  }

  if (!connection) {
    return res.status(404).json({ general: "Connection not found" });
  }
  if (connection.recipient.toString() !== req.user.id) {
    return res.status(403).json({ general: "Forbidden" });
  }
  if (connection.state !== "pending") {
    return res
      .status(400)
      .json({ general: `Connection is already ${connection.state}` });
  }

  connection.state = state;
  try {
    await connection.save();
  } catch (err) {
    return next(err);
  }

  return res.status(200).json({
    id: connection._id.toString(),
    state: connection.state,
  });
};
