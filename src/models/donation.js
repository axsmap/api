const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Is required'],
      index: true
    },
    creditedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Is required'],
      index: true
    },
    type: {
      type: String,
      enum: {
        values: ['flat'],
        message: 'Should be a valid donation type'
      },
      default: 'flat',
      required: [true, 'Is required']
    },
    amountCents: {
      type: Number,
      min: [100, 'Should be greater than or equal to 100'],
      max: [100000000, 'Should be less than or equal to 100000000'],
      required: [true, 'Is required']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: {
        values: ['USD'],
        message: 'Should be a supported currency'
      },
      required: [true, 'Is required']
    },
    donorName: {
      type: String,
      maxlength: [80, 'Should be less than 81 characters'],
      default: ''
    },
    donorEmail: {
      type: String,
      maxlength: [254, 'Should be less than 255 characters'],
      default: ''
    },
    anonymous: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    showAmountPublicly: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    status: {
      type: String,
      enum: {
        values: [
          'pending',
          'approved',
          'confirmed',
          'cancelled',
          'failed',
          'refunded',
          'reversed'
        ],
        message: 'Should be a valid donation status'
      },
      default: 'pending',
      required: [true, 'Is required'],
      index: true
    },
    checkoutToken: {
      type: String,
      required: [true, 'Is required'],
      select: false
    },
    paypalOrderId: {
      type: String,
      default: ''
    },
    paypalCaptureId: {
      type: String,
      default: ''
    },
    paypalStatus: {
      type: String,
      default: ''
    },
    confirmedAt: Date,
    refundedAt: Date,
    reversedAt: Date
  },
  { timestamps: true }
);

donationSchema.index(
  { paypalOrderId: 1 },
  { unique: true, partialFilterExpression: { paypalOrderId: { $gt: '' } } }
);
donationSchema.index(
  { paypalCaptureId: 1 },
  { unique: true, partialFilterExpression: { paypalCaptureId: { $gt: '' } } }
);
donationSchema.index({
  creditedUser: 1,
  status: 1,
  amountCents: -1,
  confirmedAt: -1
});
donationSchema.index({
  event: 1,
  creditedUser: 1,
  status: 1
});

module.exports = {
  Donation: mongoose.model('Donation', donationSchema),
  donationSchema
};
