const mongoose = require('mongoose')

const requestSchema = new mongoose.Schema(
  {
    comments: {
      type: String,
      maxlength: [300, 'Should be less than 301 characters']
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    state: {
      type: String,
      default: 'sent',
      enum: {
        values: ['sent', 'accepted', 'rejected', 'cancelled'],
        message: 'Invalid type of state'
      },
      required: [true, 'Is required']
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    teamReceiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    userReceiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
)

requestSchema.index({ createdAt: -1 })

module.exports = {
  Request: mongoose.model('Request', requestSchema),
  requestSchema
}
