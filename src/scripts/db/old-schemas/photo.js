const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema({
  review_id: {
    type: mongoose.Schema.ObjectId,
    index: true,
    ref: 'reviews'
  },
  venue_id: {
    type: mongoose.Schema.ObjectId,
    index: true,
    ref: 'venues'
  },
  user_id: {
    type: mongoose.Schema.ObjectId,
    index: true
  },
  flag: Number,
  flaggers: [
    {
      type: mongoose.Schema.ObjectId,
      index: true
    }
  ],
  s3_id: String,
  url: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
})

module.exports = reviewSchema
