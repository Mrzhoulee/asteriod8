'use strict';

// Admin-only Firebase Authentication management for the admin console.
// Client SDKs cannot enumerate or administer auth users — this uses the Admin SDK.
// Deterministic v1 URLs:
//   https://us-central1-asteroid-cdc13.cloudfunctions.net/adminListUsers
//   https://us-central1-asteroid-cdc13.cloudfunctions.net/adminAuthAction

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Only this Firebase Auth account may call these endpoints. The admin console
// signs in as this user, then sends its ID token in the Authorization header.
const ADMIN_EMAIL = 'console.admin@asteroid8.net';

function cors(res, methods) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', methods + ', OPTIONS');
}

// Verify the caller is the admin. On failure, sends the error and returns null.
async function requireAdmin(req, res) {
  const m = (req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) { res.status(401).json({ error: 'Missing auth token.' }); return null; }
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(m[1]); }
  catch (_) { res.status(401).json({ error: 'Invalid or expired token.' }); return null; }
  if ((decoded.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ error: 'Not authorized.' }); return null;
  }
  return decoded;
}

// ── List all users with their providers ─────────────────────────
exports.adminListUsers = functions.https.onRequest(async (req, res) => {
  cors(res, 'GET');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  const decoded = await requireAdmin(req, res);
  if (!decoded) return;
  try {
    const users = [];
    let pageToken;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      for (const u of page.users) {
        const providers = (u.providerData || []).map((p) => p.providerId);
        users.push({
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          providers,
          google: providers.includes('google.com'),
          apple: providers.includes('apple.com'),
          password: providers.includes('password'),
          disabled: !!u.disabled,
          created: u.metadata.creationTime || '',
          lastSignIn: u.metadata.lastSignInTime || '',
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);

    const summary = {
      total: users.length,
      google: users.filter((u) => u.google && !u.apple).length,
      apple: users.filter((u) => u.apple && !u.google).length,
      both: users.filter((u) => u.google && u.apple).length,
      email: users.filter((u) => u.password && !u.google && !u.apple).length,
    };
    return res.json({ summary, users });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error.' });
  }
});

// ── Manage users: delete / disable / enable / revoke / create / import ──
exports.adminAuthAction = functions.https.onRequest(async (req, res) => {
  cors(res, 'POST');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only.' }); return; }
  const decoded = await requireAdmin(req, res);
  if (!decoded) return;

  const auth = admin.auth();
  const body = req.body || {};
  const action = body.action;

  // Never let the admin delete/disable its own account (avoids lockout).
  async function assertNotAdmin(uid) {
    const u = await auth.getUser(uid);
    if (uid === decoded.uid || (u.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      throw new Error('Refusing to modify the admin account.');
    }
    return u;
  }

  try {
    switch (action) {
      case 'delete':
        await assertNotAdmin(body.uid);
        await auth.deleteUser(body.uid);
        return res.json({ ok: true });

      case 'disable':
      case 'enable':
        await assertNotAdmin(body.uid);
        await auth.updateUser(body.uid, { disabled: action === 'disable' });
        return res.json({ ok: true });

      case 'revoke': // "kick" — force re-authentication on all devices
        await assertNotAdmin(body.uid);
        await auth.revokeRefreshTokens(body.uid);
        return res.json({ ok: true });

      case 'create': {
        if (!body.email || !body.password) {
          return res.status(400).json({ error: 'Email and password are required.' });
        }
        const props = { email: String(body.email), password: String(body.password) };
        if (body.displayName) props.displayName = String(body.displayName);
        const u = await auth.createUser(props);
        return res.json({ ok: true, uid: u.uid });
      }

      case 'import': {
        const list = Array.isArray(body.users) ? body.users : [];
        if (!list.length) return res.status(400).json({ error: 'No users to import.' });
        const results = [];
        for (const item of list) {
          try {
            if (!item || !item.email) throw new Error('Missing email');
            const props = { email: String(item.email) };
            props.password = item.password ? String(item.password)
              : (Math.random().toString(36).slice(2) + 'Aa1!');
            if (item.displayName) props.displayName = String(item.displayName);
            const u = await auth.createUser(props);
            results.push({ email: item.email, ok: true, uid: u.uid });
          } catch (e) {
            results.push({ email: item && item.email, ok: false, error: e.message });
          }
        }
        return res.json({ ok: true, results });
      }

      default:
        return res.status(400).json({ error: 'Unknown action.' });
    }
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Action failed.' });
  }
});
