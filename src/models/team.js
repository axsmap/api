const mongoose = require('mongoose')

const teamSchema = new mongoose.Schema(
  {
    avatar: {
      type: String,
      default: `https://s3-sa-east-1.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/teams/avatars/default.png`,
      maxlength: [2000, 'Should be less than 2001 characters'],
      required: [true, 'Is required']
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    description: {
      type: String,
      maxlength: [250, 'Should be less than 251 characters']
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
    members: {
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
      maxlength: [35, 'Should be less than 36 characters'],
      required: [true, 'Is required']
    },
    slug: {
      type: String,
      maxlength: [70, 'Should be less than 71 characters'],
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
)

teamSchema.index({ name: 'text' })

module.exports = mongoose.model('Team', teamSchema)
