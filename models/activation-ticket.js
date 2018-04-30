const mongoose = require('mongoose')

const activationTicketSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      maxlength: [254, 'Should have less than 255 characters'],
      required: [true, 'Is required']
    },
    expiresAt: {
      type: Date,
      required: [true, 'Is required']
    },
    key: {
      type: String,
      maxlength: [75, 'Should have less than 76 characters'],
      required: [true, 'Is required']
    },
    userData: {
      firstName: {
        type: String,
        maxlength: [24, 'Should have less than 25 characters']
      },
      isSubscribed: {
        type: Boolean
      },
      lastName: {
        type: String,
        maxlength: [36, 'Should have less than 37 characters']
      },
      password: {
        type: String,
        maxlength: [30, 'Should have less than 31 characters'],
        minlength: [8, 'Should have more than 7 characters']
      },
      username: {
        type: String,
        maxlength: [67, 'Should have less than 68 characters']
      }
    }
  },
  { timestamps: true }
)

module.exports = {
  ActivationTicket: mongoose.model('ActivationTicket', activationTicketSchema),
  activationTicketSchema
}
