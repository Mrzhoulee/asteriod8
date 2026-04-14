const express = require("express");
const { Report, REPORT_REASONS, REPORT_TYPES, REPORT_STATUSES } = require("../models/Report");
const { requireUserId, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/v1/reports
 * Body: { contentId, contentType, reason, details? }
 * Uses x-user-id as reporterId unless body.reporterId matches (trusted clients only).
 */
router.post("/", requireUserId, async (req, res) => {
  try {
    const { contentId, contentType, reason, details } = req.body;
    if (!contentId || !contentType || !reason) {
      return res.status(400).json({ error: "contentId, contentType, reason required" });
    }
    if (!REPORT_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "invalid contentType", allowed: REPORT_TYPES });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: "invalid reason", allowed: REPORT_REASONS });
    }

    const report = await Report.create({
      reporterId: req.userId,
      contentId: String(contentId),
      contentType,
      reason,
      details: String(details || "").slice(0, 2000),
      status: "pending",
    });

    return res.status(201).json({
      id: report._id,
      reporterId: report.reporterId,
      contentId: report.contentId,
      contentType: report.contentType,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/v1/reports — admin list */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const status = req.query.status;
    const q = {};
    if (status && REPORT_STATUSES.includes(status)) q.status = status;
    const items = await Report.find(q).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ count: items.length, reports: items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** PATCH /api/v1/reports/:id — admin: { status, reviewedBy? } */
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { status, reviewedBy } = req.body;
    if (!status || !REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ error: "valid status required", allowed: REPORT_STATUSES });
    }
    const doc = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewedAt: new Date(),
        reviewedBy: String(reviewedBy || "admin").slice(0, 128),
      },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
