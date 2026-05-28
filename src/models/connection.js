const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    state: {
      type: String,
      default: 'pending',
      enum: {
        values: ['accepted', 'declined', 'pending'],
        message: 'Should be a valid state'
      },
      required: [true, 'Is required']
    },
    sharedEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
      }
    ]
  },
  { timestamps: true }
);

connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });
connectionSchema.index({ recipient: 1, state: 1, createdAt: -1 });
connectionSchema.index({ requester: 1, state: 1, createdAt: -1 });

module.exports = {
  Connection: mongoose.model('Connection', connectionSchema),
  connectionSchema
};
