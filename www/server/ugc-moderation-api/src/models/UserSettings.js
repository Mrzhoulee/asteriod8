const mongoose = require("mongoose");

/**
 * Per-user preferences for UGC / explicit handling.
 * hideExplicit defaults to true (Apple-friendly default).
 */
const userSettingsSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    hideExplicit: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

module.exports = { UserSettings: mongoose.model("UserSettings", userSettingsSchema) };
