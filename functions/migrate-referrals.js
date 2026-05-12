'use strict';

// One-shot migration: RTDB `referralCounts/{refCode}/count` → Firestore
// `users/{uid}.referral_count`, looked up by `users.referralCode == refCode`.
//
// Idempotent: writes only if the Firestore value is lower than RTDB.
// Trigger: callable HTTPS function, must include header
//   `X-Migrate-Key: <ENCRYPTION_KEY value>`
// so it can't be invoked by anyone but the operator.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const MIGRATION_KEY = defineSecret('ENCRYPTION_KEY');

exports.migrateReferralCountsRtdbToFirestore = onRequest(
  { region: 'us-central1', secrets: [MIGRATION_KEY], timeoutSeconds: 540 },
  async (req, res) => {
    if ((req.headers['x-migrate-key'] || '') !== process.env.ENCRYPTION_KEY) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const fs = admin.firestore();
    const rtdb = admin.database();

    const snap = await rtdb.ref('referralCounts').once('value');
    const all = snap.val() || {};

    const report = { read: 0, matched: 0, updated: 0, skipped: 0, unmatched: [] };

    for (const [refCode, payload] of Object.entries(all)) {
      report.read++;
      const count = Number(
        (payload && (payload.count || payload.referralCount || payload.signups || 0)) || 0
      );
      if (count <= 0) { report.skipped++; continue; }

      const q = await fs.collection('users').where('referralCode', '==', refCode).limit(1).get();
      if (q.empty) {
        report.unmatched.push(refCode);
        report.skipped++;
        continue;
      }
      report.matched++;
      const ref = q.docs[0].ref;
      const cur = q.docs[0].data().referral_count || 0;
      if (cur >= count) { report.skipped++; continue; }
      await ref.update({
        referral_count: count,
        is_referral_eligible: true,
      });
      report.updated++;
      logger.info('[migrate] updated', { uid: ref.id, refCode, count });
    }

    return res.status(200).json(report);
  }
);
