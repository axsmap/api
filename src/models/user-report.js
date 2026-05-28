const mongoose = require('mongoose');

const userReportSchema = new mongoose.Schema(
  {
    comments: {
      type: String,
      maxlength: [500, 'Should be less than 501 characters']
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    },
    status: {
      type: String,
      default: 'open',
      enum: {
        values: ['open', 'reviewed', 'dismissed'],
        message: 'Should be a valid report status'
      },
      required: [true, 'Is required']
    },
    type: {
      type: String,
      enum: {
        values: [
          'harassment',
          'impersonation',
          'offensive',
          'spam',
          'unsafe',
          'other'
        ],
        message: 'Should be a valid report type'
      },
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
);

userReportSchema.index({ target: 1, createdAt: -1 });
userReportSchema.index({ reporter: 1, target: 1, createdAt: -1 });

module.exports = {
  UserReport: mongoose.model('UserReport', userReportSchema),
  userReportSchema
};
