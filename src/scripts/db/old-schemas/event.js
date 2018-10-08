const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const schema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  creator: {
    type: ObjectId,
    ref: 'users',
    required: true
  },
  approved: {
    type: Boolean,
    default: true
  },
  event_start: {
    type: Date,
    required: true
  },
  event_end: {
    type: Date,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  location: {
    type: ObjectId,
    ref: 'venues'
  },
  goal: Number,
  mapping_goal: Number,
  participant_goal: Number,
  participant_limit: Number,
  type: String,
  image: {
    type: String,
    default: '/images/icon_pin_mapathon_water.png'
  },
  company: {
    name: String,
    address: String
  },
  charity: {
    name: String,
    email: String,
    website: String
  },
  teams: [
    {
      type: ObjectId,
      ref: 'teams'
    }
  ],
  members: [
    {
      _id: false,
      user: {
        type: ObjectId,
        ref: 'users'
      },
      team: {
        type: ObjectId,
        ref: 'teams'
      }
    }
  ]
});

module.exports = schema;
