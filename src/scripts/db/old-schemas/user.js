const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  schema_version: Number,
  name: {
    first: {
      type: String,
      required: true
    },
    last: {
      type: String,
      required: true
    }
  },
  fullName: String,
  type: String,
  description: String,
  showEmail: {
    type: Boolean,
    default: true
  },
  showPhone: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: '/images/icon_guy.png'
  },
  company: {
    name: String,
    address: String
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  phone: {
    type: String
  },
  location: {
    type: String
  },
  zip: {
    type: String
  },
  gender: {
    type: String,
    default: ''
  },
  disabilitytype: {
    type: String,
    default: ''
  },
  newsletter: {
    type: Boolean,
    default: true
  },
  isactive: {
    type: Boolean,
    default: false
  },
  isadmin: {
    type: Boolean,
    default: false
  },
  salt: {
    type: String
  },
  hash: {
    type: String
  },
  token: {
    type: String,
    default: false
  },
  activatedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  events: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'events'
    }
  ],
  images: [
    {
      type: mongoose.Schema.ObjectId,
      index: true,
      ref: 'photos'
    }
  ],
  teams: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'teams'
    }
  ],
  reset: {
    createdAt: Date,
    link: mongoose.Schema.ObjectId
  },
  foursquareId: String,
  facebookAuth: String,
  foursquareVerified: {
    type: Boolean,
    default: false
  },
  facebookVerified: {
    type: Boolean,
    default: false
  },
  username: String
})

module.exports = userSchema
