const mongoose = require('mongoose')

const petitionSchema = new mongoose.Schema(
  {
    entityId: {
      type: String,
      maxlength: [24, 'Should be less than 25 characters'],
      required: [true, 'Is required']
    },
    general: {
      type: String,
      maxlength: [250, 'Should be less than 251 characters']
    },
    receiverId: {
      type: String,
      maxlength: [24, 'Should be less than 25 characters'],
      required: [true, 'Is required']
    },
    senderId: {
      type: String,
      maxlength: [24, 'Should be less than 25 characters'],
      required: [true, 'Is required']
    },
    state: {
      type: String,
      default: 'pending',
      enum: {
        values: ['accepted', 'pending', 'rejected'],
        general: 'Invalid type of state'
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
        general: 'Invalid type of petition'
      },
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
)

petitionSchema.index({ receiverId: 1, senderId: 1 })

module.exports = {
  Petition: mongoose.model('Petition', petitionSchema),
  petitionSchema
}
