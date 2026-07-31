const express = require("express");
const { analyzeText } = require("../utils/profanityFilter");

const router = express.Router();

/**
 * POST /api/v1/moderation/validate-text
 * Body: { text, context?: "title" | "description" | "comment" }
 * If severe profanity: ok=false — client should block submit.
 */
router.post("/validate-text", (req, res) => {
  const text = String(req.body.text || "");
  const result = analyzeText(text);
  return res.json({
    ok: result.ok,
    blocked: result.blocked,
    flagged: result.flagged,
    severeMatches: result.severeMatches,
    mildMatches: result.mildMatches,
    context: req.body.context || "generic",
  });
});

module.exports = router;
