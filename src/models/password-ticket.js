const mongoose = require('mongoose')

const passwordTicketSchema = new mongoose.Schema(
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
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('PasswordTicket', passwordTicketSchema)
