const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema({
  venue_id: {
    type: mongoose.Schema.ObjectId,
    index: true,
    ref: 'venues'
  },
  user_id: {
    type: mongoose.Schema.ObjectId,
    index: true
  },
  team: {
    type: mongoose.Schema.ObjectId,
    ref: 'teams'
  },
  event: {
    type: mongoose.Schema.ObjectId,
    ref: 'events'
  },
  entry: Number,
  bathroom: Number,
  spacious: {
    type: Boolean,
    default: false
  },
  quiet: {
    type: Boolean,
    default: false
  },
  parking: {
    type: Boolean,
    default: false
  },
  ramp: {
    type: Boolean,
    default: false
  },
  secondentrance: {
    type: Boolean,
    default: false
  },
  guidedog: {
    type: Boolean,
    default: false
  },
  welllit: {
    type: Boolean,
    default: false
  },
  comment: String,
  username: String,
  abuse: Number,
  flag: Number,
  flaggers: [
    {
      type: mongoose.Schema.ObjectId,
      index: true
    }
  ],
  deleted: Boolean,
  steps: Number,
  votes: Number,
  images: [
    {
      type: mongoose.Schema.ObjectId,
      index: true,
      ref: 'photos'
    }
  ],
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
