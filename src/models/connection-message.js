const mongoose = require('mongoose');

const connectionMessageSchema = new mongoose.Schema(
  {
    connection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Connection',
      required: [true, 'Connection is required'],
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required']
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

connectionMessageSchema.index({ connection: 1, createdAt: -1 });
connectionMessageSchema.index({
  connection: 1,
  sender: 1,
  createdAt: -1
});

module.exports = {
  ConnectionMessage: mongoose.model(
    'ConnectionMessage',
    connectionMessageSchema
  ),
  connectionMessageSchema
};
