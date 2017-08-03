const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema(
  {
    bathroomScore: {
      type: Number,
      max: [5, 'Should be less than 6'],
      min: [1, 'Should be more than 0']
    },
    comments: {
      type: String,
      maxlength: [250, 'Should be less than 251 characters']
    },
    complaints: [
      {
        comments: {
          type: String,
          maxlength: [250, 'Should be less than 251 characters']
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
            message: 'Invalid type of complaint'
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
    guideDog: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isBanned: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    parking: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    quiet: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    ramp: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    secondEntry: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    spacious: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
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
    ],
    wellLit: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Review', reviewSchema)
