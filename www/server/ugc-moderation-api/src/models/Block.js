const mongoose = require("mongoose");

/** One document per (blockerId, blockedUserId) pair — idempotent blocks */
const blockSchema = new mongoose.Schema(
  {
    blockerId: { type: String, required: true, index: true },
    blockedUserId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

blockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

module.exports = { Block: mongoose.model("Block", blockSchema) };
