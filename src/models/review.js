const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    allowsGuideDog: Boolean,
    bathroomScore: {
      type: Number,
      max: [5, 'Should be less than 6'],
      min: [1, 'Should be more than 0']
    },
    comments: {
      type: String,
      maxlength: [300, 'Should be less than 301 characters']
    },
    complaints: [
      {
        comments: {
          type: String,
          maxlength: [300, 'Should be less than 30 characters']
        },
        createdAt: {
          type: Date,
          default: Date.now,
          required: [true, 'Is required']
        },
        type: {
          type: String,
          enum: {
            values: [
              'biased',
              'copyright',
              'inconsistent',
              'offensive',
              'offtopic',
              'other',
              'spam'
            ],
            general: 'Invalid type of complaint'
          },
          required: [true, 'Is required']
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: [true, 'Is required']
        }
      }
    ],
    entryScore: {
      type: Number,
      max: [5, 'Should be less than 6'],
      min: [1, 'Should be more than 0']
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    hasParking: Boolean,
    hasSecondEntry: Boolean,
    hasWellLit: Boolean,
    isBanned: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isQuiet: Boolean,
    isSpacious: Boolean,
    steps: {
      type: Number,
      max: [3, 'Should be less than 4'],
      min: [0, 'Should be more than -1']
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Is required']
    },
    voters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  { timestamps: true }
);

module.exports = {
  Review: mongoose.model('Review', reviewSchema),
  reviewSchema
};
