const mongoose = require('mongoose')

const refreshTokenSchema = new mongoose.Schema(
  {
    expiresAt: {
      type: Date,
      required: [true, 'Is required']
    },
    key: {
      type: String,
      maxlength: [80, 'Should have less than 81 characters'],
      required: [true, 'Is required'],
      unique: true
    },
    userId: {
      type: String,
      maxlength: [24, 'Should have less than 25 characters'],
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
)

module.exports = {
  RefreshToken: mongoose.model('RefreshToken', refreshTokenSchema),
  refreshTokenSchema
}
