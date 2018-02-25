const mongoose = require('mongoose')

const eventSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      maxlength: [200, 'Should be less than 201 characters'],
      required: [true, 'Is required']
    },
    description: {
      type: String,
      maxlength: [300, 'Should be less than 301 characters']
    },
    donationAmounts: {
      type: [
        {
          value: {
            type: Number,
            default: 5,
            max: [10000, 'Should be less than 10001'],
            min: [5, 'Should be greater than 4']
          },
          description: {
            type: String,
            maxlength: [100, 'Should be less than 101 characters']
          }
        }
      ]
    },
    donationEnabled: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    donationGoal: {
      type: Number,
      default: 10,
      max: [100000, 'Should be less than 100001'],
      min: [10, 'Should be greater than 9']
    },
    donationId: {
      type: String,
      default: ''
    },
    donationIntroMessage: {
      type: String,
      maxlength: [100, 'Should be less than 101 characters']
    },
    donationThanksMessage: {
      type: String,
      maxlength: [100, 'Should be less than 101 characters']
    },
    endDate: {
      type: Date,
      required: [true, 'Is required']
    },
    isArchived: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isOpen: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    location: {
      type: {
        type: String,
        default: 'Point'
      },
      coordinates: [Number]
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
      maxlength: [100, 'Should be less than 101 characters'],
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
    participantsGoal: {
      type: Number,
      max: [1000, 'Should be less than 1001'],
      min: [1, 'Should be greater than 0'],
      required: [true, 'Is required']
    },
    poster: {
      type: String,
      default: `https://s3.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/events/posters/default.png`,
      maxlength: [2000, 'Should be less than 2001 characters']
    },
    reviewsAmount: {
      type: Number,
      default: 0,
      required: [true, 'Is required']
    },
    reviewsGoal: {
      type: Number,
      max: [10000, 'Should be less than 10001'],
      min: [1, 'Should be greater than 0']
    },
    startDate: {
      type: Date,
      required: [true, 'Is required']
    },
    teamManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      }
    ],
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue'
    }
  },
  { timestamps: true }
)

eventSchema.index({
  address: 'text',
  name: 'text',
  endDate: 1,
  reviewsAmount: 1,
  startDate: 1
})

module.exports = {
  Event: mongoose.model('Event', eventSchema),
  eventSchema
}
