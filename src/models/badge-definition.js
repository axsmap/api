const mongoose = require('mongoose');

const badgeDefinitionSchema = new mongoose.Schema(
  {
    badgeId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, required: true },
    criteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    threshold: Number,
    iconUrl: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    level: String,
    visibility: {
      type: mongoose.Schema.Types.Mixed,
      default: { public: true }
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, minimize: false }
);

module.exports = {
  BadgeDefinition: mongoose.model('BadgeDefinition', badgeDefinitionSchema),
  badgeDefinitionSchema
};
