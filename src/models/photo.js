const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    complaints: [
      {
        comments: {
          type: String,
          maxlength: [300, 'Should be less than 301 characters']
        },
        createdAt: {
          type: Date,
          default: Date.now,
          required: [true, 'Is required']
        },
        type: {
          type: String,
          enum: {
            values: [
              'biased',
              'copyright',
              'inconsistent',
              'offensive',
              'offtopic',
              'other',
              'spam'
            ],
            general: 'Invalid type of complaint'
          },
          required: [true, 'Is required']
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: [true, 'Is required']
        }
      }
    ],
    fileName: {
      type: String,
      maxlength: [25, 'Should be less than 26 characters'],
      required: [true, 'Is required']
    },
    isAllowed: {
      type: Boolean,
      default: true,
      required: [true, 'Is required']
    },
    url: {
      type: String,
      maxlength: [2000, 'Should be less than 2001 characters'],
      required: [true, 'Is required']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required']
    }
  },
  { timestamps: true }
);

module.exports = {
  Photo: mongoose.model('Photo', photoSchema),
  photoSchema
};
