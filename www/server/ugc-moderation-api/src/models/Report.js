const mongoose = require("mongoose");

const REPORT_REASONS = ["harassment", "hate_speech", "nudity", "spam", "other"];
const REPORT_TYPES = ["song", "comment", "profile"];
const REPORT_STATUSES = ["pending", "reviewed", "removed"];

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: String, required: true, index: true },
    contentId: { type: String, required: true, index: true },
    contentType: { type: String, required: true, enum: REPORT_TYPES },
    reason: { type: String, required: true, enum: REPORT_REASONS },
    details: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: REPORT_STATUSES, default: "pending", index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

reportSchema.index({ contentId: 1, reporterId: 1, createdAt: -1 });

module.exports = {
  Report: mongoose.model("Report", reportSchema),
  REPORT_REASONS,
  REPORT_TYPES,
  REPORT_STATUSES,
};
