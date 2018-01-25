const mongoose = require('mongoose')

const eventSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      maxlength: [200, 'Should have less than 201 characters']
    },
    description: {
      type: String,
      maxlength: [300, 'Should have less than 301 characters']
    },
    endDate: {
      type: Date,
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
      maxlength: [100, 'Should have less than 101 characters']
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
      min: [1, 'Should be more than 0'],
      required: [true, 'Is required']
    },
    poster: {
      type: String,
      default: `https://s3-sa-east-1.amazonaws.com/${process.env
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
    ],
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue'
    }
  },
  { timestamps: true }
)

eventSchema.index({ endDate: 1, name: 'text', reviewsAmount: 1, startDate: 1 })

module.exports = {
  Event: mongoose.model('Event', eventSchema),
  eventSchema
}
