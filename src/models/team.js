const mongoose = require('mongoose')

const teamSchema = new mongoose.Schema(
  {
    avatar: {
      type: String,
      default: `https://s3.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/teams/avatars/default.png`,
      maxlength: [2000, 'Should be less than 2001 characters'],
      required: [true, 'Is required']
    },
    description: {
      type: String,
      maxlength: [300, 'Should be less than 301 characters']
    },
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
      }
    ],
    isArchived: {
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
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    name: {
      type: String,
      maxlength: [35, 'Should be less than 36 characters'],
      required: [true, 'Is required']
    },
    reviewsAmount: {
      type: Number,
      default: 0,
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
)

teamSchema.index({ name: 'text', reviewsAmount: 1 })

module.exports = {
  Team: mongoose.model('Team', teamSchema),
  teamSchema
}
