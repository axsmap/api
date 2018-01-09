const mongoose = require('mongoose')

const requestSchema = new mongoose.Schema(
  {
    comments: {
      type: String,
      maxlength: [300, 'Should be less than 301 characters']
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
