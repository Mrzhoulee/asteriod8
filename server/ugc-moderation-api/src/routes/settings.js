const express = require("express");
const { UserSettings } = require("../models/UserSettings");
const { requireUserId } = require("../middleware/auth");

const router = express.Router();

/** GET /api/v1/users/:userId/settings — own settings only */
router.get("/:userId/settings", requireUserId, async (req, res) => {
  try {
    if (req.params.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let doc = await UserSettings.findOne({ userId: req.params.userId }).lean();
    if (!doc) {
      doc = { userId: req.params.userId, hideExplicit: true };
    }
    return res.json({ userId: doc.userId, hideExplicit: doc.hideExplicit !== false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

/** PATCH /api/v1/users/:userId/settings — body: { hideExplicit: boolean } */
router.patch("/:userId/settings", requireUserId, async (req, res) => {
  try {
    if (req.params.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (typeof req.body.hideExplicit !== "boolean") {
      return res.status(400).json({ error: "hideExplicit boolean required" });
    }
    const doc = await UserSettings.findOneAndUpdate(
      { userId: req.params.userId },
      { userId: req.params.userId, hideExplicit: req.body.hideExplicit },
      { upsert: true, new: true }
    ).lean();
    return res.json({ userId: doc.userId, hideExplicit: doc.hideExplicit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
