const mongoose = require("mongoose");

const donation = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ["one_time", "monthly"], required: true },
  productId: String, // e.g. "monthlysupporter" or "donation_small"
  transactionId: String, // Apple transaction ID
  originalTransactionId: String, // same for subscription renewals
  amount: Number, // optional, from Apple response
  currency: String, // optional
  country: String, // optional
  status: {
    type: String,
    enum: ["purchased", "renewed", "canceled", "refunded"],
  },
  platform: String,
  purchasedAt: { type: Date, default: Date.now },
  expiresAt: Date, // only for subscriptions
});

module.exports = {
  Donations: mongoose.model("Donations", donation),
  donation,
};
