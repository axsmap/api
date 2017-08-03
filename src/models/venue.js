const mongoose = require('mongoose')

const venueSchema = new mongoose.Schema(
  {
    bathroomReviews: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than 1']
    },
    bathroomScore: {
      type: Number,
      default: 0,
      max: [5, 'Should be less than 6'],
      min: [0, 'Should be more than -1']
    },
    entryReviews: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    entryScore: {
      type: Number,
      default: 0,
      max: [5, 'Should be less than 6'],
      min: [0, 'Should be more than -1']
    },
    googlePlaceID: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters'],
      required: [true, 'Is required']
    },
    guideDog: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    isArchived: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    parking: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    photos: [
      {
        banned: {
          type: Boolean,
          default: false,
          required: [true, 'Is required']
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
        uploadedAt: {
          type: Date,
          default: Date.now,
          required: [true, 'Is required']
        },
        url: {
          type: String,
          maxlength: [2000, 'Should be less than 2001 characters'],
          required: [true, 'Is required']
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: [true, 'Is required']
        }
      }
    ],
    quiet: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    ramp: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    reviews: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Review'
      }
    ],
    secondEntry: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    spacious: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    stepsReviews: {
      type: [Number],
      default: [0, 0, 0, 0]
    },
    wellLit: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    }
  },
  { timestamps: true }
)

venueSchema.index({ googlePlaceID: 1 })

module.exports = mongoose.model('Venue', venueSchema)
