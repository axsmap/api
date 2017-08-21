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
    location: {
      latitude: {
        type: Number,
        max: [90, 'Should be less than 91'],
        min: [-90, 'Should be more than -91']
      },
      longitude: {
        type: Number,
        max: [180, 'Should be less than 181'],
        min: [-180, 'Should be more than -181']
      }
    },
    name: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters']
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
    placeId: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters'],
      required: [true, 'Is required']
    },
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
    types: [
      {
        type: String,
        maxlength: [50, 'Should be less than 51 characters']
      }
    ],
    vicinity: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters']
    },
    wellLit: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    }
  },
  { timestamps: true }
)

venueSchema.index({ placeId: 1 })

module.exports = mongoose.model('Venue', venueSchema)
