const mongoose = require('mongoose')

const eventSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      maxlength: [80, 'Should have less than 81 characters']
    },
    country: {
      type: String,
      maxlength: [50, 'Should have less than 51 characters']
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    description: {
      type: String,
      maxlength: [250, 'Should have less than 251 characters']
    },
    endDate: {
      type: Date,
      required: [true, 'Is required']
    },
    isApproved: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isPublic: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    managers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      required: [true, 'Is required']
    },
    name: {
      type: String,
      maxlength: [100, 'Should have less than 101 characters'],
      required: [true, 'Is required']
    },
    participantsGoal: {
      type: Number,
      max: [1000, 'Should be less than 1001'],
      min: [2, 'Should be more than 1'],
      required: [true, 'Is required']
    },
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      required: [true, 'Is required']
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
    point: {
      type: {
        type: String,
        default: 'Point',
        required: [true, 'Is required']
      },
      coordinates: {
        type: [Number],
        required: [true, 'Is required']
      }
    },
    poster: {
      type: String,
      default: `https://s3-sa-east-1.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/events/posters/default.png`,
      maxlength: [2000, 'Should be less than 2001 characters'],
      required: [true, 'Is required']
    },
    reviews: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    reviewsGoal: {
      type: Number,
      max: [10000, 'Should be less than 10001'],
      min: [10, 'Should be more than 9']
    },
    slug: {
      type: String,
      maxlength: [200, 'Should be less than 201 characters'],
      required: [true, 'Is required']
    },
    startDate: {
      type: Date,
      required: [true, 'Is required']
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      }
    ]
  },
  { timestamps: true }
)

eventSchema.index({ point: '2dsphere' })

module.exports = {
  Event: mongoose.model('Event', eventSchema),
  eventSchema
}
