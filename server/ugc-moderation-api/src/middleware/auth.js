/**
 * Minimal user identity from header.
 * Replace with JWT verification (e.g. firebase-admin, Auth0) in production.
 */
function requireUserId(req, res, next) {
  const uid = (req.headers["x-user-id"] || "").trim();
  if (!uid) {
    return res.status(401).json({ error: "Missing x-user-id header" });
  }
  req.userId = uid;
  next();
}

function requireAdmin(req, res, next) {
  const key = (req.headers["x-admin-key"] || req.query.adminKey || "").trim();
  const expected = process.env.ADMIN_API_KEY || "";
  if (!expected || key !== expected) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

module.exports = { requireUserId, requireAdmin };
