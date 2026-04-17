const mongoose = require('mongoose');

const eventParticipantSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Is required'],
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required'],
      index: true
    },
    personalMessage: {
      type: String,
      maxlength: [280, 'Should be less than 281 characters'],
      default: ''
    }
  },
  { timestamps: true }
);

eventParticipantSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = {
  EventParticipant: mongoose.model('EventParticipant', eventParticipantSchema),
  eventParticipantSchema
};
