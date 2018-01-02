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
      maxlength: [300, 'Should have less than 301 characters']
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
      maxlength: [100, 'Should have less than 101 characters']
    },
    participantsGoal: {
      type: Number,
      max: [1000, 'Should be less than 1001'],
      min: [1, 'Should be more than 0'],
      required: [true, 'Is required']
    },
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ]
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
    poster: {
      type: String,
      default: `https://s3-sa-east-1.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/events/posters/default.png`,
      maxlength: [2000, 'Should be less than 2001 characters']
    },
    reviews: {
      type: Number,
      default: 0,
      min: [0, 'Should be more than -1']
    },
    reviewsGoal: {
      type: Number,
      max: [10000, 'Should be less than 10001'],
      min: [1, 'Should be more than 0']
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

module.exports = {
  Event: mongoose.model('Event', eventSchema),
  eventSchema
}
