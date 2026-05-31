const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { Connection } = require("../../models/connection");

// DELETE /connections/:id  — either party can delete.
module.exports = async (req, res, next) => {
  const id = req.params.id;
  if (!isMongoId(id)) {
    return res.status(404).json({ general: "Connection not found" });
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

  const userId = req.user.id;
  if (
    connection.requester.toString() !== userId &&
    connection.recipient.toString() !== userId
  ) {
    return res.status(403).json({ general: "Forbidden" });
  }

  try {
    await connection.deleteOne();
  } catch (err) {
    return next(err);
  }

  return res.status(200).json({ general: "Connection removed" });
};
