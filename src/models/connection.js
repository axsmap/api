const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Is required"],
      index: true,
    },
    state: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
      index: true,
    },
    // The mapathon that surfaced the request. Used for the
    // "Mapped together in <event>" context line when sharedEvents is empty.
    originEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },
  },
  { timestamps: true }
);

// Mongo doesn't support unordered-pair uniqueness natively. The pre-save
// guard below catches the case where a connection already exists with the
// participants in either ordering. There's a tiny race window under
// concurrent writes; acceptable for v1.
connectionSchema.pre("save", async function preventDuplicatePair(next) {
  if (!this.isNew) return next();
  if (this.requester.toString() === this.recipient.toString()) {
    return next(new Error("requester and recipient must differ"));
  }
  const Connection = this.constructor;
  const existing = await Connection.findOne({
    $or: [
      { requester: this.requester, recipient: this.recipient },
      { requester: this.recipient, recipient: this.requester },
    ],
  }).lean();
  if (existing) {
    const err = new Error("Connection already exists");
    err.code = "DUPLICATE_CONNECTION";
    err.existing = existing;
    return next(err);
  }
  return next();
});

connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = {
  Connection: mongoose.model("Connection", connectionSchema),
  connectionSchema,
};
