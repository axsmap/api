const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: String,
  goal: Number,
  corporation: String,
  description: String,
  password: String,
  image: {
    type: String,
    default: '/images/icon_team.png'
  },
  creator: {
    type: mongoose.Schema.ObjectId,
    ref: 'users'
  },
  events: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'events'
    }
  ],
  updated_at: {
    type: Date,
    default: Date.now
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  members: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'users'
    }
  ],
  invites: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'invites'
    }
  ],
  approved: {
    type: Boolean,
    default: true
  }
});

module.exports = venueSchema;
