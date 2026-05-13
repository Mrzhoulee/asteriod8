'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const OWNER_EMAIL    = defineSecret('OWNER_EMAIL');

const COOKIE_NAME    = 'referrer_artist_id';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const COOKIE_DOMAIN  = 'asteroid8.net';
const CLICK_IP_SALT  = 'asteroid8-click-salt-v1';

const MILESTONES = [
  { count: 5,   tier: 'supporter' },
  { count: 10,  tier: 'trailblazer' },
  { count: 25,  tier: 'featured' },
  { count: 50,  tier: 'partner' },
  { count: 100, tier: 'equity_eligible' },
];

const sanitizeKey = (s) => String(s || '').replace(/[.#$[\]]/g, '_');
const db    = () => admin.firestore();
const rtdb  = () => admin.database();

let satoriModule, ResvgCtor, ResendCtor, fontCache;

// ─────────────────────────────────────────────────────────────
// /r/{slug}
// ─────────────────────────────────────────────────────────────
exports.referralRedirect = onRequest(
  { region: 'us-central1', cors: false },
  async (req, res) => {
    try {
      const m = req.path.match(/^\/r\/([^/?#]+)/);
      const slug = m ? decodeURIComponent(m[1]).toLowerCase() : null;
      if (!slug) return res.redirect(302, '/');

      const snap = await db().collection('users')
        .where('slug', '==', slug).limit(1).get();
      if (snap.empty) {
        logger.info('[referralRedirect] unknown slug', { slug });
        return res.redirect(302, '/');
      }
      const artistId = snap.docs[0].id;

      const ipRaw = (req.headers['x-forwarded-for'] || '')
        .toString().split(',')[0].trim() || req.ip || '';
      const ipHash = crypto.createHash('sha256')
        .update(ipRaw + CLICK_IP_SALT).digest('hex').substring(0, 32);
      const userAgent = (req.headers['user-agent'] || '').toString().substring(0, 256);

      db().collection('referral_clicks').add({
        artist_id: artistId,
        ip_hash: ipHash,
        user_agent: userAgent,
        clicked_at: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((e) => logger.warn('[referralRedirect] click write failed', e));

      res.setHeader('Set-Cookie', [
        `${COOKIE_NAME}=${artistId}`,
        'Path=/',
        `Max-Age=${COOKIE_MAX_AGE}`,
        `Domain=${COOKIE_DOMAIN}`,
        'HttpOnly', 'Secure', 'SameSite=Lax',
      ].join('; '));

      return res.redirect(302, `/join?ref=${encodeURIComponent(slug)}`);
    } catch (err) {
      logger.error('[referralRedirect] error', err);
      return res.redirect(302, '/');
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/signup/attribute
// ─────────────────────────────────────────────────────────────
exports.signupAttribute = onRequest(
  { region: 'us-central1', cors: false, secrets: [RESEND_API_KEY, OWNER_EMAIL] },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const authz = req.headers.authorization || '';
    const bearer = authz.match(/^Bearer (.+)$/);
    if (!bearer) return res.status(401).json({ error: 'missing_token' });

    let decoded;
    try { decoded = await admin.auth().verifyIdToken(bearer[1]); }
    catch (_) { return res.status(401).json({ error: 'invalid_token' }); }
    const uid = decoded.uid;

    const cookies = Object.fromEntries(
      (req.headers.cookie || '').split(';')
        .map((c) => c.trim().split('='))
        .filter((p) => p.length === 2)
    );
    const artistId = cookies[COOKIE_NAME];
    if (!artistId) return res.status(200).json({ attributed: false, reason: 'no_cookie' });
    if (artistId === uid) return res.status(200).json({ attributed: false, reason: 'self_referral' });

    const fs = db();
    const supRef    = fs.collection('founding_supporters').doc(`${artistId}_${uid}`);
    const artistRef = fs.collection('users').doc(artistId);
    const userRef   = fs.collection('users').doc(uid);

    let signupOrder = null;
    let oldCount = null;
    let newCount = null;
    let artistEmail = null;

    try {
      await fs.runTransaction(async (tx) => {
        const [supSnap, artistSnap] = await Promise.all([tx.get(supRef), tx.get(artistRef)]);
        if (supSnap.exists) {
          signupOrder = supSnap.data().signup_order;
          return;
        }
        if (!artistSnap.exists) throw new Error('artist_not_found');
        const a = artistSnap.data();
        if (!a.is_referral_eligible) throw new Error('artist_not_eligible');

        artistEmail = a.email || '';
        oldCount = a.referral_count || 0;
        newCount = oldCount + 1;
        signupOrder = newCount;

        tx.set(supRef, {
          artist_id: artistId,
          user_id: uid,
          signup_order: signupOrder,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(artistRef, { referral_count: admin.firestore.FieldValue.increment(1) });
        tx.set(userRef, {
          referred_by_artist_id: artistId,
          signup_order_for_artist: signupOrder,
        }, { merge: true });
      });
    } catch (err) {
      logger.error('[signupAttribute] tx failed', err);
      const code = err.message || 'tx_failed';
      const status = code === 'artist_not_found' || code === 'artist_not_eligible' ? 400 : 500;
      return res.status(status).json({ error: code });
    }

    try {
      const artistKey   = sanitizeKey(artistEmail || artistId);
      const followerKey = sanitizeKey(decoded.email || uid);
      await Promise.all([
        rtdb().ref(`FOLLOWS/${artistKey}/${followerKey}`).set(true),
        rtdb().ref(`FOLLOWING/${followerKey}/${artistKey}`).set(true),
      ]);
    } catch (e) {
      logger.warn('[signupAttribute] auto-follow failed', e);
    }

    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=; Path=/; Max-Age=0; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax`);

    if (oldCount !== null && newCount !== null) {
      try {
        await checkMilestones(artistId, oldCount, newCount,
          process.env.RESEND_API_KEY, process.env.OWNER_EMAIL);
      } catch (e) {
        logger.error('[signupAttribute] milestone check failed', e);
      }
    }

    return res.status(200).json({
      attributed: true, artist_id: artistId, signup_order: signupOrder,
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Milestone helper — idempotent via deterministic audit_log doc ID
// ─────────────────────────────────────────────────────────────
async function checkMilestones(artistId, oldCount, newCount, resendKey, ownerEmail) {
  const crossed = MILESTONES.filter((m) => oldCount < m.count && newCount >= m.count);
  if (!crossed.length) return [];

  const fs = db();
  const out = [];

  for (const ms of crossed) {
    const auditRef = fs.collection('audit_log').doc(`${artistId}_milestone_${ms.count}`);
    try {
      await auditRef.create({
        event_type: 'milestone_triggered',
        artist_id: artistId,
        milestone: ms.count,
        tier: ms.tier,
        payload: { count_at_trigger: newCount },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      if (e.code === 6 || e.code === 'already-exists') {
        logger.info('[milestone] already awarded', { artistId, count: ms.count });
        continue;
      }
      throw e;
    }

    const artistRef = fs.collection('users').doc(artistId);
    const artistSnap = await artistRef.get();
    const artist = artistSnap.data() || {};
    const updates = { tier: ms.tier };

    if (ms.count === 10) {
      updates.vipStatus    = true;
      updates.vipStartDate = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000));
    } else if (ms.count === 25) {
      await fs.collection('featureQueue').add({
        userUid: artistId,
        username: artist.username || '',
        referralCount: newCount,
        songCount: artist.songCount || 0,
        source: 'milestone_25',
        expires_at: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processed: false,
      });
    } else if (ms.count === 50) {
      updates.partnerStatus = true;
    } else if (ms.count === 100) {
      updates.equityEligible = true;
    }
    await artistRef.update(updates);

    const messageId = rtdb().ref('artistInbox').push().key;
    await rtdb().ref(`artistInbox/${sanitizeKey(artistId)}/${messageId}`).set({
      type: 'milestone',
      milestone: ms.count,
      tier: ms.tier,
      title: milestoneTitle(ms),
      body: milestoneBody(ms),
      read: false,
      created_at: admin.database.ServerValue.TIMESTAMP,
    });

    try { await sendMilestonePush(artistId, ms); }
    catch (e) { logger.warn('[milestone] FCM failed', e); }

    try { if (resendKey) await sendMilestoneEmail(artist, ms, newCount, resendKey, ownerEmail); }
    catch (e) { logger.warn('[milestone] email failed', e); }

    out.push({ milestone: ms.count, tier: ms.tier });
  }
  return out;
}

function milestoneTitle(ms) {
  return ({
    5:   'You hit 5 supporters',
    10:  'Trailblazer unlocked — VIP for life',
    25:  'Featured — queued for the homepage',
    50:  'Partner status unlocked',
    100: 'Equity-eligible — Otto will reach out',
  })[ms.count];
}
function milestoneBody(ms) {
  return `Milestone ${ms.count} reached. Tier set to ${ms.tier}.`;
}

async function sendMilestonePush(artistId, ms) {
  const snap = await rtdb().ref(`PROFILES/${sanitizeKey(artistId)}/fcmToken`).once('value');
  const token = snap.val();
  if (!token) return;
  await admin.messaging().send({
    token,
    notification: { title: milestoneTitle(ms), body: milestoneBody(ms) },
    webpush: { fcm_options: { link: 'https://www.asteroid8.net/artist-referrals' } },
  });
}

async function sendMilestoneEmail(artist, ms, count, resendKey, ownerEmail) {
  if (!ResendCtor) ResendCtor = require('resend').Resend;
  const resend = new ResendCtor(resendKey);
  const from = 'Asteroid <hello@asteroid8.net>';

  if (artist.email) {
    await resend.emails.send({
      from, to: artist.email,
      subject: milestoneTitle(ms),
      text: `${milestoneBody(ms)}\n\nDashboard: https://www.asteroid8.net/artist-referrals`,
    });
  }
  if ((ms.count === 50 || ms.count === 100) && ownerEmail) {
    await resend.emails.send({
      from, to: ownerEmail,
      subject: `[Asteroid] ${artist.username || artist.email || 'Artist'} reached milestone ${ms.count}`,
      text: `${artist.username || ''} (${artist.email || ''}) → ${count} referrals, tier=${ms.tier}.`,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// /api/badge/{userId}/{artistId}.png
// ─────────────────────────────────────────────────────────────
const INTER_BOLD_URL = 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf';

async function getFont() {
  if (fontCache) return fontCache;
  const res = await fetch(INTER_BOLD_URL);
  if (!res.ok) throw new Error(`font fetch ${res.status}`);
  fontCache = Buffer.from(await res.arrayBuffer());
  return fontCache;
}

exports.badgePng = onRequest(
  { region: 'us-central1', cors: false, memory: '512MiB' },
  async (req, res) => {
    try {
      const m = req.path.match(/^\/api\/badge\/([^/]+)\/([^/]+)\.png$/);
      if (!m) return res.status(404).send('not found');
      const [, userId, artistId] = m;

      if (!satoriModule) satoriModule = (await import('satori')).default;
      if (!ResvgCtor)    ResvgCtor    = require('@resvg/resvg-js').Resvg;
      const font = await getFont();

      const fs = db();
      const [userSnap, artistSnap, supSnap] = await Promise.all([
        fs.collection('users').doc(userId).get(),
        fs.collection('users').doc(artistId).get(),
        fs.collection('founding_supporters').doc(`${artistId}_${userId}`).get(),
      ]);
      if (!supSnap.exists) return res.status(404).send('not found');

      const user   = userSnap.data() || {};
      const artist = artistSnap.data() || {};
      const order  = supSnap.data().signup_order;

      const svg = await satoriModule(
        {
          type: 'div',
          props: {
            style: {
              width: '1080px', height: '1080px',
              background: 'linear-gradient(135deg, #ff7f50, #1a0b2e)',
              color: '#fff', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '80px',
              fontFamily: 'Inter',
            },
            children: [
              { type: 'div', props: { style: { fontSize: 56, opacity: 0.85, marginBottom: 24 }, children: 'Founding Supporter' } },
              { type: 'div', props: { style: { fontSize: 280, fontWeight: 900, lineHeight: 1 }, children: `#${order}` } },
              { type: 'div', props: { style: { fontSize: 56, marginTop: 24 }, children: `for ${artist.username || 'Artist'}` } },
              { type: 'div', props: { style: { fontSize: 36, opacity: 0.6, marginTop: 80 }, children: `@${user.username || 'fan'} • asteroid8.net` } },
            ],
          },
        },
        { width: 1080, height: 1080, fonts: [{ name: 'Inter', data: font, weight: 900, style: 'normal' }] }
      );

      const png = new ResvgCtor(svg, { fitTo: { mode: 'width', value: 1080 } }).render().asPng();
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400, immutable');
      return res.send(png);
    } catch (err) {
      logger.error('[badgePng] error', err);
      return res.status(500).send('error');
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Exposed for tests
// ─────────────────────────────────────────────────────────────
exports.checkMilestones = checkMilestones;
exports.MILESTONES = MILESTONES;
exports.sanitizeKey = sanitizeKey;
exports.milestoneTitle = milestoneTitle;
exports.milestoneBody = milestoneBody;

// ─────────────────────────────────────────────────────────────
// Nightly safety net
// ─────────────────────────────────────────────────────────────
exports.scheduledMilestones = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'UTC', region: 'us-central1',
    secrets: [RESEND_API_KEY, OWNER_EMAIL] },
  async () => {
    const fs = db();
    const snap = await fs.collection('users')
      .where('is_referral_eligible', '==', true).get();

    for (const doc of snap.docs) {
      const artistId = doc.id;
      const count = doc.data().referral_count || 0;
      if (count <= 0) continue;

      for (const ms of MILESTONES) {
        if (count < ms.count) break;
        const auditRef = fs.collection('audit_log')
          .doc(`${artistId}_milestone_${ms.count}`);
        const audit = await auditRef.get();
        if (audit.exists) continue;

        logger.info('[scheduledMilestones] backfilling', { artistId, count: ms.count });
        await checkMilestones(artistId, ms.count - 1, ms.count,
          process.env.RESEND_API_KEY, process.env.OWNER_EMAIL);
      }
    }
  }
);
