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
    },
    personalGoal: {
      type: Number,
      default: 15,
      min: [1, 'Should be greater than or equal to 1'],
      max: [10000, 'Should be less than or equal to 10000']
    },
    fundraisingGoal: {
      type: Number,
      default: 0,
      min: [0, 'Should be greater than or equal to 0'],
      max: [1000000, 'Should be less than or equal to 1000000']
    },
    fundraisingAmountRaised: {
      type: Number,
      default: 0,
      min: [0, 'Should be greater than or equal to 0']
    },
    hiddenFromProfile: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

eventParticipantSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = {
  EventParticipant: mongoose.model('EventParticipant', eventParticipantSchema),
  eventParticipantSchema
};
