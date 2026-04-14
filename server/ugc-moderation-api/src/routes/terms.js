const express = require("express");
const { TermsAcceptance } = require("../models/TermsAcceptance");
const { requireUserId } = require("../middleware/auth");

const router = express.Router();

/** POST /api/v1/terms/accept — requires x-user-id; body: { termsVersion? } */
router.post("/accept", requireUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const termsVersion = String(req.body.termsVersion || "1.0").slice(0, 32);
    const acceptedAt = new Date();
    await TermsAcceptance.findOneAndUpdate(
      { userId },
      { userId, termsVersion, acceptedAt },
      { upsert: true, new: true }
    );
    return res.status(201).json({ userId, termsVersion, acceptedAt: acceptedAt.toISOString() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/v1/terms/status/:userId — own status only (x-user-id must match) */
router.get("/status/:userId", requireUserId, async (req, res) => {
  try {
    if (req.params.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const doc = await TermsAcceptance.findOne({ userId: req.params.userId }).lean();
    if (!doc) return res.json({ accepted: false });
    return res.json({
      accepted: true,
      termsVersion: doc.termsVersion,
      acceptedAt: doc.acceptedAt,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
