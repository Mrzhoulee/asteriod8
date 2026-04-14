const express = require("express");
const { Block } = require("../models/Block");
const { requireUserId } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/v1/blocks
 * Body: { blockedUserId }
 * Records block for moderation audit; client must also filter feed locally.
 */
router.post("/", requireUserId, async (req, res) => {
  try {
    const blockedUserId = String(req.body.blockedUserId || "").trim();
    if (!blockedUserId) return res.status(400).json({ error: "blockedUserId required" });
    if (blockedUserId === req.userId) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }

    await Block.findOneAndUpdate(
      { blockerId: req.userId, blockedUserId },
      { blockerId: req.userId, blockedUserId },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      blockerId: req.userId,
      blockedUserId,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/v1/blocks/me — list blocked user ids for authenticated user */
router.get("/me", requireUserId, async (req, res) => {
  try {
    const rows = await Block.find({ blockerId: req.userId }).select("blockedUserId createdAt").lean();
    return res.json({
      blockerId: req.userId,
      blockedUserIds: rows.map((r) => r.blockedUserId),
      entries: rows,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
