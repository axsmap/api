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
    // Phase 2 spec item #4 — per-mapathon personal goal (review count target).
    // Defaults to 15 per product spec.
    personalGoal: {
      type: Number,
      default: 15,
      min: [1, 'Should be greater than or equal to 1'],
      max: [10000, 'Should be less than or equal to 10000']
    },
    // Spec "hide past participation" toggle. When true, the entry is still in
    // the user's events[] but the frontend treats it as hidden on the profile.
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
