const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    //new expanded fields
    hasPermanentRamp: Boolean,
    hasPortableRamp: Boolean,
    hasWideEntrance: Boolean,
    hasAccessibleTableHeight: Boolean,
    hasAccessibleElevator: Boolean,
    hasInteriorRamp: Boolean,
    hasSwingOutDoor: Boolean,
    hasLargeStall: Boolean,
    hasSupportAroundToilet: Boolean,
    hasLoweredSinks: Boolean,

    //original fields
    allowsGuideDog: Boolean,
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

    /*
     * deprecated 5-star scoring
     */
    _entryScore: {
      type: Number
      //max: [9, 'Should be less than 10'],
      //min: [1, 'Should be more than 0']
    },
    _bathroomScore: {
      type: Number
      //max: [4, 'Should be less than 5'],
      //min: [1, 'Should be more than 0']
    },
    _isScoreConverted: {
      type: Boolean,
      default: false
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
