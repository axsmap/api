const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  schema_version: Number,
  google_id: {
    type: String,
    index: true
  },
  google_ref: String,
  place_id: {
    type: String,
    index: true
  },
  name: String,
  addr1: String,
  addr2: String,
  city: String,
  state: String,
  ph: String,
  url: String,
  types: Array,
  ll: Array,
  lngLat: {
    type: Array,
    index: '2d'
  },
  google_rating: {
    type: Number,
    default: 0
  },
  google_url: String,
  entry: {
    type: Number,
    default: 0
  },
  e_reviews: {
    type: Number,
    default: 0
  },
  bathroom: {
    type: Number,
    default: 0
  },
  b_reviews: {
    type: Number,
    default: 0
  },
  welllit: {
    type: Number,
    default: 0
  },
  spacious: {
    type: Number,
    default: 0
  },
  quiet: {
    type: Number,
    default: 0
  },
  parking: {
    type: Number,
    default: 0
  },
  ramp: {
    type: Number,
    default: 0
  },
  secondentrance: {
    type: Number,
    default: 0
  },
  guidedog: {
    type: Number,
    default: 0
  },
  steps: {
    type: Number,
    default: -1
  },
  steps_0: {
    type: Number,
    default: 0
  },
  steps_1: {
    type: Number,
    default: 0
  },
  steps_2: {
    type: Number,
    default: 0
  },
  steps_3: {
    type: Number,
    default: 0
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  reviewdata: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'reviews'
    }
  ],
  images: [
    {
      type: mongoose.Schema.ObjectId,
      index: true,
      ref: 'photos'
    }
  ]
});

module.exports = venueSchema;
