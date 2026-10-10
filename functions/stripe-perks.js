'use strict';

// Pure logic for the Stripe webhook (no firebase imports, so it is easy to test).
//
// A fan buys a fan perk (Shoutout, Song request, Supporter...) through a Stripe
// Payment Link opened from a concert room. The room adds
//   client_reference_id = <artist>__<showId>__<perk>__<fan|guest>
// (see js/concert-rewards.js stripeUrl). On checkout.session.completed we:
//   1. show the fan's message on screen in that room   CONCERT_SHOUTOUTS/{room}/{sessionId}
//   2. credit the fan's points                         REWARDS/tips/{fanKey}/{sessionId}
//   3. save who wants a heads up for the next show      FAN_OPTIN/{fanKey}/{artist}
//   4. keep the full order for the admin page           STRIPE_ORDERS/{sessionId}

const crypto = require('crypto');

const SIGNATURE_TOLERANCE_SEC = 300;

/** Stripe-Signature check: t=<unix>,v1=<hex hmac sha256 of "t.payload">. */
function verifyStripeSignature(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!rawBody || !header || !secret) return false;
  let t = null;
  const v1 = [];
  for (const part of String(header).split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !v1.length) return false;
  if (Math.abs(nowSec - Number(t)) > SIGNATURE_TOLERANCE_SEC) return false;
  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex'), 'utf8');
  return v1.some((sig) => {
    const got = Buffer.from(sig, 'utf8');
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

/** Same key the RTDB rules derive from auth.token.email. */
function rewardsKey(email) {
  return String(email || '').trim().toLowerCase().replace(/\./g, '_');
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

function cleanText(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function titleCase(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** client_reference_id -> {artistSlug, showId, perk, who} or null. */
function parseReference(ref) {
  const parts = String(ref || '').split('__');
  if (parts.length < 4) return null;
  const who = parts[parts.length - 1];
  if (who !== 'fan' && who !== 'guest') return null;
  const perk = parts[parts.length - 2];
  const artistSlug = parts[0];
  const showId = parts.slice(1, parts.length - 2).join('__');
  if (!artistSlug || !showId || !perk) return null;
  return { artistSlug, showId, perk, who };
}

function readCustomFields(session) {
  const out = [];
  for (const f of (session && session.custom_fields) || []) {
    if (!f) continue;
    const label = cleanText((f.label && (f.label.custom || f.label.type)) || f.key, 80);
    let value = '';
    if (f.type === 'text' && f.text) value = f.text.value;
    else if (f.type === 'numeric' && f.numeric) value = f.numeric.value;
    else if (f.type === 'dropdown' && f.dropdown) {
      const opt = (f.dropdown.options || []).find((o) => o && o.value === f.dropdown.value);
      value = opt ? opt.label : f.dropdown.value;
    }
    value = cleanText(value, 255);
    if (value) out.push({ key: cleanText(f.key, 60), type: String(f.type || ''), label, value });
  }
  return out;
}

/** Amount in US cents, also when Stripe showed the fan a local currency. */
function usdCents(session) {
  const conv = session && session.currency_conversion;
  if (conv && String(conv.source_currency || '').toLowerCase() === 'usd' && Number.isFinite(Number(conv.amount_total))) {
    return Math.round(Number(conv.amount_total));
  }
  if (String((session && session.currency) || '').toLowerCase() === 'usd') return Math.round(Number(session.amount_total) || 0);
  return 0;
}

/**
 * @param {object} session Stripe Checkout Session from checkout.session.completed
 * @param {object} db firebase-admin database()
 */
async function processCheckoutSession(session, db, now = Date.now()) {
  if (!session || session.object !== 'checkout.session') return { skipped: 'not a checkout session' };
  if (session.payment_status !== 'paid') return { skipped: 'not paid yet' };
  const ref = parseReference(session.client_reference_id);
  if (!ref) return { skipped: 'not a concert payment' };
  const id = String(session.id || '').replace(/[.#$[\]/]/g, '_');
  if (!id) return { skipped: 'no session id' };

  const orderRef = db.ref('STRIPE_ORDERS/' + id);
  if ((await orderRef.once('value')).exists()) return { skipped: 'already processed' };

  const [showSnap, perksSnap] = await Promise.all([
    db.ref('CONCERT_SCHEDULE/' + ref.showId).once('value'),
    db.ref('CONCERT_CONFIG/perks').once('value'),
  ]);
  const show = showSnap.val();
  let room = show && /^Room[1-5]$/.test(show.room) ? show.room : '';
  const roomMatch = /^room([1-5])$/.exec(ref.showId);
  if (!room && roomMatch) room = 'Room' + roomMatch[1];
  const artist = cleanText(show && show.artist ? show.artist : titleCase(ref.artistSlug), 80);
  const perksRaw = perksSnap.val();
  const perks = Array.isArray(perksRaw) ? perksRaw : Object.values(perksRaw || {});
  const perkName = cleanText(((perks.find((p) => p && slug(p.name) === ref.perk) || {}).name) || titleCase(ref.perk), 40);

  const details = session.customer_details || {};
  const email = cleanText(details.email, 200).toLowerCase();
  const fullName = cleanText(details.name, 80);
  const firstName = cleanText(fullName.split(' ')[0], 20) || 'A fan';
  const fields = readCustomFields(session);
  const message = cleanText((fields.find((f) => f.type === 'text') || {}).value, 140);
  const optIn = fields.some((f) => f.type === 'dropdown' && /next show|heads up/i.test(f.label) && /^yes/i.test(f.value));
  const cents = usdCents(session);

  const updates = {};
  updates['STRIPE_ORDERS/' + id] = {
    ts: now, email, name: fullName, perk: perkName, artist, showId: ref.showId, room,
    amountCents: cents, currency: String(session.currency || '').toLowerCase(),
    amountTotal: Number(session.amount_total) || 0, fields, optIn,
  };
  if (room) {
    updates['CONCERT_SHOUTOUTS/' + room + '/' + id] = { ts: now, name: firstName, perk: perkName, message, artist, showId: ref.showId };
  }
  if (email && cents > 0) {
    updates['REWARDS/tips/' + rewardsKey(email) + '/' + id] = {
      amountCents: cents, artist, email, ts: now, source: 'stripe', perk: perkName, note: 'Stripe: ' + perkName,
    };
  }
  if (email && optIn) {
    updates['FAN_OPTIN/' + rewardsKey(email) + '/' + (slug(artist) || 'artist')] = { email, name: fullName, artist, ts: now };
  }
  await db.ref().update(updates);
  return { ok: true, room, artist, perk: perkName, cents, optIn, message: !!message };
}

module.exports = {
  verifyStripeSignature,
  parseReference,
  readCustomFields,
  usdCents,
  rewardsKey,
  processCheckoutSession,
};
