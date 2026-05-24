#!/usr/bin/env node
/**
 * Build a unified roster of every Asteroid artist with cross-cut stats
 * aggregated from every known RTDB path (and optionally Firestore).
 *
 * Joins on PROFILES/{emailKey} — the canonical user record. Other paths
 * are keyed by emailKey (most), Firebase UID (Firestore), or the AST
 * referral code (legacy RTDB referral counters).
 *
 * Run from project root:
 *   node scripts/artist-roster.js              # writes artist-roster.csv (public paths only)
 *   node scripts/artist-roster.js --json       # also writes artist-roster.json
 *   node scripts/artist-roster.js --print=20   # prints top 20 by composite activity
 *
 * For protected RTDB paths (FOLLOWS, FAN_ENGAGEMENT, ARTIST_STORIES, etc.) and
 * Firestore, pass an admin access token:
 *
 *   gcloud auth application-default login
 *   TOKEN=$(gcloud auth application-default print-access-token)
 *   node scripts/artist-roster.js --token="$TOKEN"
 *
 * The token works for both RTDB (passed as ?auth=) and Firestore (Bearer header).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RTDB = 'https://asteroid-cdc13-default-rtdb.firebaseio.com';
const FS_BASE = 'https://firestore.googleapis.com/v1/projects/asteroid-cdc13/databases/(default)/documents';

const argv = process.argv.slice(2);
const wantJson  = argv.includes('--json');
const wantPrint = (() => {
  const a = argv.find((x) => x.startsWith('--print='));
  return a ? parseInt(a.split('=')[1], 10) || 10 : 10;
})();
const TOKEN = (() => {
  const a = argv.find((x) => x.startsWith('--token='));
  return a ? a.split('=').slice(1).join('=') : process.env.GOOGLE_ACCESS_TOKEN || '';
})();

function sanitize(s) { return String(s || '').trim().replace(/[.#$[\]]/g, '_'); }
function countKeys(o) { return o && typeof o === 'object' ? Object.keys(o).length : 0; }
function csvEscape(s) {
  s = String(s == null ? '' : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function rtdbGet(p) {
  const u = new URL(`${RTDB}/${p}.json`);
  if (TOKEN) u.searchParams.set('access_token', TOKEN);
  const res = await fetch(u.toString());
  if (!res.ok) { console.warn(`  ! RTDB ${p} → ${res.status}`); return null; }
  return res.json();
}

async function firestoreGetAll(collection) {
  // Public Firestore reads via REST. Returns a flat array of {id, data}.
  const docs = [];
  let pageToken = '';
  for (let i = 0; i < 40; i++) {
    const u = new URL(`${FS_BASE}/${collection}`);
    u.searchParams.set('pageSize', '300');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
    const res = await fetch(u.toString(), { headers });
    if (!res.ok) { console.warn(`  ! Firestore ${collection} → ${res.status}`); return docs; }
    const body = await res.json();
    for (const d of (body.documents || [])) {
      docs.push({ id: d.name.split('/').pop(), data: unwrapFs(d.fields || {}) });
    }
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
  }
  return docs;
}
function unwrapFs(fields) {
  const out = {};
  for (const k of Object.keys(fields)) {
    const f = fields[k];
    if (f.stringValue !== undefined) out[k] = f.stringValue;
    else if (f.integerValue !== undefined) out[k] = Number(f.integerValue);
    else if (f.doubleValue !== undefined) out[k] = Number(f.doubleValue);
    else if (f.booleanValue !== undefined) out[k] = f.booleanValue;
    else if (f.timestampValue !== undefined) out[k] = f.timestampValue;
    else if (f.nullValue !== undefined) out[k] = null;
    else if (f.mapValue) out[k] = unwrapFs(f.mapValue.fields || {});
    else if (f.arrayValue) out[k] = (f.arrayValue.values || []).map((v) => unwrapFs({ x: v }).x);
  }
  return out;
}

function deepWalkSongs(node, visit) {
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (!v || typeof v !== 'object') continue;
    // A song "leaf" has audio/file fields or a definite title+uploader pair
    const looksLikeSong = ('fileInp' in v) || ('title' in v && ('uploader' in v || 'uploaderOwnerKey' in v));
    if (looksLikeSong) visit(v);
    else deepWalkSongs(v, visit);
  }
}

function activeStories(s) {
  if (!s || typeof s !== 'object') return 0;
  const now = Date.now();
  return Object.values(s).filter((x) => x && Number(x.expiresAt) > now).length;
}

(async () => {
  console.log('Fetching RTDB tree (parallel)…');
  const [
    profiles, follows, following, stories, qa, notices, journeysArtist,
    engagement, stickiesProfile, songs, boostSongs, referralCounts,
    agreements, premium, featuredSong, featuredSocials, refCodesByUser,
    refCodeIndex, listenJourneys, googleLinked,
  ] = await Promise.all([
    rtdbGet('PROFILES'),
    rtdbGet('FOLLOWS'),
    rtdbGet('FOLLOWING'),
    rtdbGet('ARTIST_STORIES'),
    rtdbGet('ARTIST_QA'),
    rtdbGet('ARTIST_NOTICES'),
    rtdbGet('ARTIST_JOURNEYS'),
    rtdbGet('FAN_ENGAGEMENT'),
    rtdbGet('PROFILE_STICKIES'),
    rtdbGet('SONGS'),
    rtdbGet('boostSongs'),
    rtdbGet('referralCounts'),
    rtdbGet('AGREEMENTS'),
    rtdbGet('PREMIUM'),
    rtdbGet('FEATURED_ARTIST_SONG'),
    rtdbGet('FEATURED_SOCIAL_LINKS'),
    rtdbGet('REFERRAL_CODES_BY_USER'),
    rtdbGet('REFERRAL_CODE_INDEX'),
    rtdbGet('LISTEN_JOURNEYS'),
    rtdbGet('GOOGLE_LINKED'),
  ]);

  console.log('Fetching Firestore (users, songs, founding_supporters)…');
  const [fsUsers, fsSongs, fsSupporters] = await Promise.all([
    firestoreGetAll('users'),
    firestoreGetAll('songs'),
    firestoreGetAll('founding_supporters'),
  ]);

  // Build cross-cut indexes
  console.log('Building indexes…');

  // Songs per uploader (RTDB SONGS is a deep tree)
  const songsBy = new Map();
  deepWalkSongs(songs, (s) => {
    const key = sanitize(s.uploaderOwnerKey || s.uploader);
    if (key) songsBy.set(key, (songsBy.get(key) || 0) + 1);
  });

  // Boost songs per uploader
  const boostsBy = new Map();
  if (boostSongs) {
    for (const b of Object.values(boostSongs)) {
      const key = sanitize((b && b.uploader) || '');
      if (key) boostsBy.set(key, (boostsBy.get(key) || 0) + 1);
    }
  }

  // Firestore users — emailKey -> firestore data (match by sanitized email)
  const fsByEmailKey = new Map();
  const fsByUid = new Map();
  for (const u of fsUsers) {
    fsByUid.set(u.id, u.data);
    if (u.data.email) fsByEmailKey.set(sanitize(u.data.email), u.data);
  }

  // Firestore songs per ownerUid
  const fsSongsByUid = new Map();
  for (const s of fsSongs) {
    const uid = s.data.ownerUid;
    if (uid) fsSongsByUid.set(uid, (fsSongsByUid.get(uid) || 0) + 1);
  }

  // Founding supporters per artist (artist_id is a Firebase UID)
  const supportersByUid = new Map();
  for (const sup of fsSupporters) {
    const aid = sup.data.artist_id;
    if (aid) supportersByUid.set(aid, (supportersByUid.get(aid) || 0) + 1);
  }

  // Build the CSV
  console.log('Composing roster…');
  const header = [
    'emailKey', 'nickname', 'role', 'visibility', 'createdAt', 'joinedViaMarketing',
    'bio', 'accentColor', 'pfp',
    'instagram', 'soundcloud', 'spotify', 'youtube', 'applemusic', 'bandcamp', 'tiktok',
    'website', 'socialLink',
    'referredBy', 'rtdbReferralCode',
    // Cross-cut RTDB counts
    'followers', 'following', 'songs', 'boostSongs',
    'storiesTotal', 'storiesActive', 'qaQuestions', 'notices', 'artistJourneys',
    'fanEngagementEvents', 'profileStickies', 'agreementsAccepted',
    'referralClicks', 'referralSignups',
    'featuredSongSet', 'featuredSocialsSet', 'isPremium', 'googleLinked',
    'listenJourneys',
    // Firestore matches (joined on email)
    'fsUid', 'fsVipStatus', 'fsVipStartDate', 'fsReferralCode',
    'fsReferralCount', 'fsSongCount', 'fsEligibleForFeature',
    'fsTier', 'fsPartnerStatus', 'fsEquityEligible',
    'fsIsReferralEligible', 'fsSlug',
    'fsSongsInFirestore', 'fsFoundingSupportersCount',
  ];
  const rows = [header];

  const profileEntries = Object.entries(profiles || {});
  for (const [emailKey, raw] of profileEntries) {
    const p = raw || {};
    const fsU = fsByEmailKey.get(emailKey) || {};
    const fsUid = (() => {
      for (const u of fsUsers) {
        if (u.data.email && sanitize(u.data.email) === emailKey) return u.id;
      }
      return '';
    })();

    const rcRtdb = (() => {
      // Legacy RTDB referral counters might be keyed by emailKey OR by AST code.
      // Check both.
      if (!referralCounts) return null;
      if (referralCounts[emailKey]) return referralCounts[emailKey];
      // Try matching via REFERRAL_CODES_BY_USER → AST code
      const ast = refCodesByUser && refCodesByUser[emailKey];
      if (ast && referralCounts[ast]) return referralCounts[ast];
      return null;
    })();

    rows.push([
      emailKey,
      p.nickname || p.fullName || p.displayName || '',
      p.role || '',
      p.profileVisibility || '',
      p.createdAt || '',
      p.joinedViaMarketing ? 'yes' : '',
      p.bio || '', p.accentColor || '', p.pfp || '',
      p.instagram || '', p.soundcloud || '', p.spotify || '', p.youtube || '',
      p.applemusic || '', p.bandcamp || '', p.tiktok || '',
      p.website || '', p.socialLink || '',
      p.referredBy || '', (refCodesByUser && refCodesByUser[emailKey]) || '',
      countKeys(follows?.[emailKey]),
      countKeys(following?.[emailKey]),
      songsBy.get(emailKey) || 0,
      boostsBy.get(emailKey) || 0,
      countKeys(stories?.[emailKey]),
      activeStories(stories?.[emailKey]),
      countKeys(qa?.[emailKey]),
      countKeys(notices?.[emailKey]),
      countKeys(journeysArtist?.[emailKey]),
      countKeys(engagement?.[emailKey]?.events),
      countKeys(stickiesProfile?.[emailKey]),
      countKeys(agreements?.[emailKey]),
      (rcRtdb && (rcRtdb.clicks || rcRtdb.count)) || 0,
      (rcRtdb && (rcRtdb.signups || rcRtdb.count)) || 0,
      featuredSong?.[emailKey] ? 'yes' : '',
      featuredSocials?.[emailKey] ? 'yes' : '',
      premium?.[emailKey] ? 'yes' : '',
      googleLinked?.[emailKey] ? 'yes' : '',
      countKeys(listenJourneys?.[emailKey]),
      // Firestore
      fsUid,
      fsU.vipStatus ? 'yes' : '',
      fsU.vipStartDate || '',
      fsU.referralCode || '',
      fsU.referralCount || 0,
      fsU.songCount || 0,
      fsU.eligibleForFeature ? 'yes' : '',
      fsU.tier || '',
      fsU.partnerStatus ? 'yes' : '',
      fsU.equityEligible ? 'yes' : '',
      fsU.is_referral_eligible ? 'yes' : '',
      fsU.slug || '',
      fsSongsByUid.get(fsUid) || 0,
      supportersByUid.get(fsUid) || 0,
    ]);
  }

  // Write CSV
  const csvPath = path.resolve(process.cwd(), 'artist-roster.csv');
  fs.writeFileSync(csvPath, rows.map((r) => r.map(csvEscape).join(',')).join('\n'));
  console.log(`\n✔ Wrote ${csvPath}`);
  console.log(`  ${rows.length - 1} profile rows, ${header.length} columns each.`);

  if (wantJson) {
    const jsonPath = path.resolve(process.cwd(), 'artist-roster.json');
    const objs = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    fs.writeFileSync(jsonPath, JSON.stringify(objs, null, 2));
    console.log(`✔ Wrote ${jsonPath}`);
  }

  // Print a quick activity ranking to the terminal
  const ranked = rows.slice(1)
    .map((r) => {
      const o = Object.fromEntries(header.map((h, i) => [h, r[i]]));
      return {
        name: o.nickname || o.emailKey,
        role: o.role || '(unset)',
        songs: Number(o.songs) + Number(o.fsSongsInFirestore || 0),
        followers: Number(o.followers),
        stories: Number(o.storiesActive),
        referrals: Number(o.fsReferralCount) || Number(o.referralSignups),
      };
    })
    .sort((a, b) => (b.songs * 5 + b.followers + b.referrals * 3) - (a.songs * 5 + a.followers + a.referrals * 3));

  console.log(`\nTop ${wantPrint} by composite activity (songs×5 + followers + referrals×3):`);
  for (let i = 0; i < Math.min(wantPrint, ranked.length); i++) {
    const a = ranked[i];
    console.log(`  ${String(i + 1).padStart(2)}. ${a.name.padEnd(30)} ${a.role.padEnd(10)} songs:${String(a.songs).padStart(3)} followers:${String(a.followers).padStart(3)} stories:${String(a.stories).padStart(2)} refs:${String(a.referrals).padStart(2)}`);
  }

  console.log(`\nOpen artist-roster.csv in Numbers/Excel/Google Sheets.`);
  console.log(`Or filter on the command line, e.g.:`);
  console.log(`  head -1 artist-roster.csv; awk -F, 'NR>1 && $21>0 {print}' artist-roster.csv`);
})();
