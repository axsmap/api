const mongoose = require('mongoose')

const venueSchema = new mongoose.Schema(
  {
    allowsGuideDog: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    bathroomReviews: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than 1']
    },
    bathroomScore: {
      type: Number,
      max: [5, 'Should be less than 6'],
      min: [1, 'Should be more than 0']
    },
    entryReviews: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    entryScore: {
      type: Number,
      max: [5, 'Should be less than 6'],
      min: [1, 'Should be more than 0']
    },
    hasParking: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasRamp: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasSecondEntry: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    hasWellLit: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    isArchived: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isQuiet: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    isSpacious: {
      yes: {
        type: Number,
        default: 0
      },
      no: {
        type: Number,
        default: 0
      }
    },
    location: {
      type: {
        type: String,
        default: 'Point'
      },
      coordinates: [Number]
    },
    name: {
      type: String,
      maxlength: [255, 'Should be less than 256 characters']
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
    reviews: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Review'
      }
    ],
    steps: {
      zero: {
        type: Number,
        default: 0
      },
      one: {
        type: Number,
        default: 0
      },
      two: {
        type: Number,
        default: 0
      },
      moreThanTwo: {
        type: Number,
        default: 0
      }
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
    }
  },
  { timestamps: true }
)

venueSchema.index({
  name: 'text',
  location: '2dsphere',
  placeId: 1,
  vicinity: 'text'
})

module.exports = mongoose.model('Venue', venueSchema)
