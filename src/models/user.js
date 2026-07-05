const bcrypt = require("bcrypt-nodejs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    avatar: {
      type: String,
      default: `https://s3.amazonaws.com/${
        process.env.AWS_S3_BUCKET
      }/users/avatars/default.png`,
      maxlength: [2000, "Should be less than 2001 characters"],
      required: [true, "Is required"],
    },
    description: {
      type: String,
      maxlength: [2000, "Should be less than 2001 characters"],
    },
    disabilities: {
      type: [String],
      default: ["none"],
      enum: {
        values: [
          "brain",
          "cognitive",
          "hearing",
          "invisible",
          "none",
          "other",
          "physical",
          "private",
          "psychological",
          "spinal-cord",
          "vision",
        ],
        general: "Invalid type of disability",
      },
      required: [true, "Is required"],
    },
    email: {
      type: String,
      maxlength: [254, "Should be less than 255 characters"],
    },
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    facebookId: String,
    firstName: {
      type: String,
      maxlength: [24, "Should be less than 25 characters"],
    },
    gender: {
      type: String,
      default: "not-to-say",
      enum: {
        values: [
          "female",
          "male",
          "other",
          "private",
          "transgender",
          "non-binary",
          "gender-fluid",
          "agender",
          "not-to-say",
        ],
        general: "Invalid type of gender",
      },
      required: [true, "Is required"],
    },
    googleId: String,
    appleId: String,
    hashedPassword: {
      type: String,
      maxlength: [256, "Should be less than 255 characters"],
    },
    isAdmin: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
      index: true,
    },
    // Users this user has blocked from connecting / appearing in their
    // participant lists. See PR #205 spec section 4.4 for cascade behavior.
    blockedConnectionUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    // Who may send this user a connection request:
    //   "mapathon" — anyone who shares a Mapathon with them (default)
    //   "mutual"   — only people they already share an accepted connection with
    //   "none"     — opt out of incoming connection requests entirely
    // Enforced on POST /connections against the RECIPIENT's preference.
    connectionPreference: {
      type: String,
      enum: ["mapathon", "mutual", "none"],
      default: "mapathon",
      required: [true, "Is required"],
    },
    isArchived: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    inactivityEmailSent: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    inactivityEmailSentAt: {
      type: Date,
      default: null,
    },
    reactivatedAt: {
      type: Date,
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    isSubscribed: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    isSystemAccount: {
      type: Boolean,
      default: false,
    },
    lastName: {
      type: String,
      maxlength: [36, "Should be less than 37 characters"],
    },
    language: {
      type: String,
      default: "en",
      enum: {
        values: ["en", "es"],
        general: "Invalid type of language",
      },
      required: [true, "Is required"],
    },
    phone: {
      type: String,
      maxlength: [50, "Should be less than 51 characters"],
    },
    reviewFieldsAmount: {
      type: Number,
      default: 0,
      required: [true, "Is required"],
    },
    reviewsAmount: {
      type: Number,
      default: 0,
      required: [true, "Is required"],
    },
    showDisabilities: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    lastActivityTime: {
      type: Date,
      default: null,
    },
    // Tracks REAL app-open events only (sign-in, social sign-in, token refresh).
    // Intentionally NOT touched by middleware/syncs/admin scripts — see ticket
    // "Add Mongo lastOpenedAt Field and Prepare Salesforce User Status Migration".
    // Salesforce User Status logic will eventually migrate from lastActivityTime
    // to this field. Do NOT set this from background jobs.
    lastOpenedAt: {
      type: Date,
      default: null,
    },
    lastLocation: {
      type: {
        lat: {
          type: Number,
        },
        lng: {
          type: Number,
        },
      },
      default: {
        lat: null,
        lng: null,
      },
    },
    device: {
      type: String,
      default: "",
    },
    showEmail: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    // Controls whether the user's identity (firstName, lastName, username,
    // avatar, email) is shown on public surfaces where they're referenced —
    // leaderboards, user search, public profiles, venue review attribution,
    // team rosters, event participant/manager lists, connections. "anonymous"
    // masks it to "Anonymous"/null; "displayName" shows it. Owner-facing
    // endpoints and admins always see the real identity. Default "displayName".
    publicVisibility: {
      type: String,
      enum: ["displayName", "anonymous"],
      default: "displayName",
      required: [true, "Is required"],
    },
    // One-time onboarding modal bookkeeping. New users set this true (they pick
    // during onboarding); existing users default false so the frontend can show
    // the modal once on next login, then PUT it to true.
    promptedForVisibility: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    showPhone: {
      type: Boolean,
      default: false,
      required: [true, "Is required"],
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
      },
    ],
    username: {
      type: String,
      maxlength: [67, "Should be less than 68 characters"],
    },
    zip: {
      type: String,
      maxlength: [32, "Should be less than 33 characters"],
    },
    aboutMe: {
      type: String,
      maxlength: [500, "Should be 500 characters or fewer"],
    },
    birthday: {
      type: Date,
      default: null,
      required: false,
    },
    race: {
      type: String,
      default: "",
      enum: [
        "black/african american",
        "caucasian",
        "indigenous/first nation/native american",
        "latino/hispanic",
        "middle eastern/north african",
        "native hawaiian/pacific islander",
        "biracial/multiracial",
        "asian",
        "non-naucasian",
        "not-to-disclose",
        "",
      ],
      required: false,
    },
    disability: {
      type: String,
      default: "",
      enum: ["yes", "no", "No", "not-to-say", ""],
      required: false,
    },
    // Phase 2 user-profile fields. Frontend-only — not synced to Salesforce.
    // When null, frontend falls back to `${firstName} ${lastName[0]}.`
    displayName: {
      type: String,
      maxlength: [60, "Should be less than 61 characters"],
      default: null,
    },
    socials: {
      twitter: { type: String, maxlength: 100, default: "" },
      linkedin: { type: String, maxlength: 200, default: "" },
      instagram: { type: String, maxlength: 100, default: "" },
      facebook: { type: String, maxlength: 200, default: "" },
      website: { type: String, maxlength: 300, default: "" },
    },
    // Profiles are public by default; users opt OUT via the edit-account
    // privacy toggle (sets this false). The profile-privacy gate in
    // get-user.js only masks when this is explicitly false.
    profilePublic: {
      type: Boolean,
      default: true,
      required: [true, "Is required"],
    },
    hideLocation: { type: Boolean, default: false },
    hideBadges: { type: Boolean, default: false },
    hideSupporters: { type: Boolean, default: false },
    hideSocials: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index(
  {
    email: "text",
    firstName: "text",
    lastName: "text",
    username: "text",
    reviewsAmount: 1,
  },
  { weights: { email: 5, username: 5 } }
);

function hashPassword(password) {
  // Sync hash so the doc has `hashedPassword` set before mongoose validates / saves.
  // The previous callback-based async hash returned immediately and let `User.create()` /
  // `user.save()` race ahead — when Mongo's write won the race the user was persisted with
  // no hashedPassword and could never sign in.
  const salt = bcrypt.genSaltSync(10);
  this.hashedPassword = bcrypt.hashSync(password, salt);
}

function comparePassword(password) {
  return bcrypt.compareSync(password, this.hashedPassword ?? '');
}

userSchema.virtual("password").set(hashPassword);
userSchema.methods.comparePassword = comparePassword;

module.exports = {
  User: mongoose.model("User", userSchema),
  userSchema,
};
