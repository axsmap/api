const mongoose = require('mongoose')

const petitionSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    message: {
      type: String,
      maxlength: [300, 'Should be less than 301 characters']
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    state: {
      type: String,
      default: 'pending',
      enum: {
        values: ['accepted', 'canceled', 'pending', 'rejected'],
        message: 'Should be a valid state'
      },
      required: [true, 'Is required']
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    type: {
      type: String,
      enum: {
        values: [
          'invite-team-event',
          'invite-user-event',
          'invite-user-team',
          'request-team-event',
          'request-user-event',
          'request-user-team'
        ],
        message: 'Should be a valid type'
      },
      required: [true, 'Is required']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
)

petitionSchema.index({ createdAt: -1 })

module.exports = {
  Petition: mongoose.model('Petition', petitionSchema),
  petitionSchema
}
