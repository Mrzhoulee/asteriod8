const mongoose = require("mongoose");

const termsAcceptanceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    termsVersion: { type: String, default: "1.0" },
    acceptedAt: { type: Date, required: true },
  },
  { timestamps: false }
);

module.exports = { TermsAcceptance: mongoose.model("TermsAcceptance", termsAcceptanceSchema) };
