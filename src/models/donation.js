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
        values: ['flat', 'pledge'],
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
    pledgeAmountCents: {
      type: Number,
      min: [100, 'Should be greater than or equal to 100'],
      max: [100000000, 'Should be less than or equal to 100000000']
    },
    pledgeCapCents: {
      type: Number,
      min: [100, 'Should be greater than or equal to 100'],
      max: [100000000, 'Should be less than or equal to 100000000']
    },
    showPledgePublicly: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    pledgeEligibleLocations: {
      type: Number,
      min: [0, 'Should be greater than or equal to 0']
    },
    pledgeFinalAmountCents: {
      type: Number,
      min: [0, 'Should be greater than or equal to 0'],
      max: [100000000, 'Should be less than or equal to 100000000']
    },
    pledgeCalculatedAt: Date,
    pledgeClosedAt: Date,
    pledgeClosedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    salesforceSync: {
      status: {
        type: String,
        enum: {
          values: ['not_ready', 'pending', 'synced', 'failed'],
          message: 'Should be a valid Salesforce sync status'
        },
        default: 'not_ready'
      },
      recordId: {
        type: String,
        default: ''
      },
      attempts: {
        type: Number,
        min: [0, 'Should be greater than or equal to 0'],
        default: 0
      },
      lastAttemptAt: Date,
      syncedAt: Date,
      lastError: {
        type: String,
        maxlength: [2000, 'Should be less than 2001 characters'],
        default: ''
      }
    },
    status: {
      type: String,
      enum: {
        values: [
          'pending',
          'pledged',
          'approved',
          'calculated',
          'payment_requested',
          'paid',
          'confirmed',
          'cancelled',
          'failed',
          'expired',
          'uncollected',
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
      required: function() {
        return this.type === 'flat';
      },
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
    paypalPayerEmail: {
      type: String,
      maxlength: [254, 'Should be less than 255 characters'],
      default: ''
    },
    salesforceOpportunityId: {
      type: String,
      default: ''
    },
    salesforceSyncedAt: Date,
    salesforceSyncError: {
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
donationSchema.index({
  type: 1,
  'salesforceSync.status': 1,
  pledgeClosedAt: 1
});

module.exports = {
  Donation: mongoose.model('Donation', donationSchema),
  donationSchema
};
