const bcrypt = require('bcrypt-nodejs')
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    avatar: {
      type: String,
      default: `https://s3.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/users/avatars/default.png`,
      maxlength: [2000, 'Should have less than 2001 characters'],
      required: [true, 'Is required']
    },
    description: {
      type: String,
      maxlength: [2000, 'Should have less than 2001 characters']
    },
    disabilities: {
      type: [String],
      default: ['none'],
      enum: {
        values: [
          'brain',
          'cognitive',
          'hearing',
          'invisible',
          'none',
          'other',
          'physical',
          'private',
          'psychological',
          'spinal-cord',
          'vision'
        ],
        general: 'Invalid type of disability'
      },
      required: [true, 'Is required']
    },
    email: {
      type: String,
      maxlength: [254, 'Should have less than 255 characters']
    },
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
      }
    ],
    facebookId: String,
    firstName: {
      type: String,
      maxlength: [24, 'Should have less than 25 characters'],
      required: [true, 'Is required']
    },
    gender: {
      type: String,
      default: 'private',
      enum: {
        values: ['female', 'male', 'other', 'private', 'transgender'],
        general: 'Invalid type of gender'
      },
      required: [true, 'Is required']
    },
    googleId: String,
    hashedPassword: {
      type: String,
      maxlength: [256, 'Should have less than 255 characters']
    },
    isAdmin: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isArchived: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isBlocked: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    isSubscribed: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    lastName: {
      type: String,
      maxlength: [36, 'Should have less than 37 characters'],
      required: [true, 'Is required']
    },
    language: {
      type: String,
      default: 'en',
      enum: {
        values: ['en', 'es'],
        general: 'Invalid type of language'
      },
      required: [true, 'Is required']
    },
    phone: {
      type: String,
      maxlength: [50, 'Should have less than 51 characters']
    },
    showDisabilities: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    showEmail: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    showPhone: {
      type: Boolean,
      default: false,
      required: [true, 'Is required']
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
      }
    ],
    username: {
      type: String,
      maxlength: [67, 'Should have less than 68 characters']
    },
    zip: {
      type: String,
      maxlength: [32, 'Should have less than 33 characters']
    }
  },
  { timestamps: true }
)

userSchema.index(
  {
    email: 'text',
    firstName: 'text',
    lastName: 'text',
    username: 'text'
  },
  { weights: { email: 5, username: 5 } }
)

function hashPassword(password) {
  bcrypt.genSalt(10, (errorOnSaltGeneration, salt) => {
    if (errorOnSaltGeneration) {
      return false
    }

    bcrypt.hash(
      password,
      salt,
      null,
      (errorOnHashingPassword, hashedPassword) => {
        if (errorOnHashingPassword) {
          return false
        }

        this.hashedPassword = hashedPassword
        return true
      }
    )
  })
}

function comparePassword(password) {
  return bcrypt.compareSync(password, this.hashedPassword)
}

userSchema.virtual('password').set(hashPassword)
userSchema.methods.comparePassword = comparePassword

module.exports = {
  User: mongoose.model('User', userSchema),
  userSchema
}
