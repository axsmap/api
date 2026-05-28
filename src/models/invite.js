const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: {
        values: ['email', 'phone'],
        message: 'Should be a valid invite channel'
      },
      required: [true, 'Is required']
    },
    contact: {
      type: String,
      maxlength: [254, 'Should be less than 255 characters'],
      required: [true, 'Is required']
    },
    deliveryState: {
      type: String,
      default: 'recorded',
      enum: {
        values: ['recorded', 'sent', 'failed'],
        message: 'Should be a valid delivery state'
      },
      required: [true, 'Is required']
    },
    inviteUrl: {
      type: String,
      maxlength: [2000, 'Should be less than 2001 characters']
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
);

inviteSchema.index({ sender: 1, createdAt: -1 });
inviteSchema.index({ contact: 1, channel: 1, sender: 1 });

module.exports = {
  Invite: mongoose.model('Invite', inviteSchema),
  inviteSchema
};
