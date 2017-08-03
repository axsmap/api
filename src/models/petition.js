const mongoose = require('mongoose')

const petitionSchema = new mongoose.Schema(
  {
    entityID: {
      type: String,
      maxlength: [24, 'Should be less than 25 characters'],
      required: [true, 'Is required']
    },
    message: {
      type: String,
      maxlength: [250, 'Should be less than 251 characters']
    },
    receiverID: {
      type: String,
      maxlength: [24, 'Should be less than 25 characters'],
      required: [true, 'Is required']
    },
    senderID: {
      type: String,
      maxlength: [24, 'Should be less than 25 characters'],
      required: [true, 'Is required']
    },
    state: {
      type: String,
      default: 'pending',
      enum: {
        values: ['accepted', 'pending', 'rejected'],
        message: 'Invalid type of state'
      },
      required: [true, 'Is required']
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
        message: 'Invalid type of petition'
      },
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
)

petitionSchema.index({ receiverID: 1, senderID: 1 })

module.exports = mongoose.model('Petition', petitionSchema)
