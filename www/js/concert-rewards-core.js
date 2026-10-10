// Shared logic for concert rewards: config, keys, shows, streaks, balances.
// Used by the concert rooms, the concerts lobby and admin-rewards.html.
//
// RTDB layout
//   CONCERT_SCHEDULE/{showId}   {room:"Room1", artist, artists, startsAt, endsAt}   admin only
//                               artists = every artist in the show ["Nova","Luna"]
//                               artist  = "Nova & Luna" (label, kept for older app versions)
//   CONCERT_CONFIG              rewards numbers + artists list                  admin only
//                               artists/{id} = {name, emailKey, tipLink}
//   CONCERT_PRESENCE/{room}/{viewer}  server timestamp, removed on disconnect
//   FAN_SURVEY/{key}            {role, fanOf[], other, ts, email?}              admin read
//   REWARDS/attendance/{uk}/{showId}  {ts, room}   fan writes once per show while it is live
//   REWARDS/tips/{uk}/{id}            {amountCents, artist, ts, email}   admin credits real tips
//   REWARDS/adjust/{uk}/{id}          {points, reason, ts}               admin only
//   REWARDS/redemptions/{uk}/{id}     {type, points, status, ts, ...}    fan requests, admin fulfils
//
// uk = rewardsKey(email). database.rules.json derives the same key from the
// signed in Firebase user, so nobody can write points for another account.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-6qtVYHfipL_c6g5JzXKXCxMN5WDKU7A",
  authDomain: "asteroid-cdc13.firebaseapp.com",
  databaseURL: "https://asteroid-cdc13-default-rtdb.firebaseio.com",
  projectId: "asteroid-cdc13",
  storageBucket: "asteroid-cdc13.appspot.com",
  messagingSenderId: "793353824502",
  appId: "1:793353824502:web:3ac24821911d14773ba4d7",
  measurementId: "G-GV72TMNNGR",
};

export const ADMIN_EMAIL = "console.admin@asteroid8.net";
export const POINTS_PER_USD = 100; // 100 points = $1
export const STREAM_MAX_MS = 10 * 60 * 60 * 1000; // matches the rooms' 10 hour auto end
export const ROOMS = ["Room1", "Room2", "Room3", "Room4", "Room5"];
export const GIFT_CARDS = [
  "Starbucks", "Apple", "Uber", "Uber Eats", "Google Play",
  "Target", "Xbox", "Lyft", "Airbnb", "Roblox",
];
export const REDEEM_LABELS = {
  giftcard: "Gift card",
  tip: "Tip with points",
  shoutout: "Shoutout",
  badge: "Supporter badge",
  early: "Early access",
};

export const DEFAULT_CONFIG = {
  pointsPerDollar: 10,      // points per $1 tipped (10 pts = $0.10, the 10% rewards share)
  pointsPerShow: 5,         // points for watching a scheduled show
  attendMinutes: 10,        // minutes watched before a show counts
  streakDays: 3,            // show days in a row for a streak bonus
  streakBonusPoints: 500,   // 500 pts = a free $5 gift card
  minGiftCardUsd: 5,
  viewerCountThreshold: 30, // viewer count stays hidden below this
  artistSharePct: 80,
  rewardsSharePct: 10,
  asteroidSharePct: 10,
  costs: { shoutout: 100, badge: 300, early: 200, minTip: 100 },
  instagram: "https://instagram.com/asteroidincofficial",
  tipLink: "",              // Stripe Payment Link ("customers choose what to pay")
  perks: [],                // fixed price Stripe Payment Links: [{name, price, url}]
  artists: {},              // id -> {name, emailKey}
};

const NUMERIC_KEYS = [
  "pointsPerDollar", "pointsPerShow", "attendMinutes", "streakDays", "streakBonusPoints",
  "minGiftCardUsd", "viewerCountThreshold", "artistSharePct", "rewardsSharePct", "asteroidSharePct",
];

export function readConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = { ...DEFAULT_CONFIG, ...src };
  for (const k of NUMERIC_KEYS) {
    const n = Number(src[k]);
    cfg[k] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_CONFIG[k];
  }
  if (cfg.streakDays < 1) cfg.streakDays = DEFAULT_CONFIG.streakDays;
  const costs = { ...DEFAULT_CONFIG.costs };
  for (const k of Object.keys(costs)) {
    const n = Number(src.costs && src.costs[k]);
    if (Number.isFinite(n) && n > 0) costs[k] = Math.floor(n);
  }
  cfg.costs = costs;
  cfg.instagram = typeof src.instagram === "string" && /^https:\/\//.test(src.instagram) ? src.instagram : DEFAULT_CONFIG.instagram;
  cfg.artists = src.artists && typeof src.artists === "object" ? src.artists : {};
  cfg.perks = readPerks(src.perks);
  cfg.tipLink = typeof src.tipLink === "string" && /^https:\/\/[^\s"'<>]+$/.test(src.tipLink.trim()) ? src.tipLink.trim() : "";
  return cfg;
}

function readPerks(raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  const out = [];
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const name = String(p.name || "").trim().slice(0, 40);
    const price = Number(p.price);
    const url = String(p.url || "").trim();
    if (!name || !(price > 0) || !/^https:\/\/[^\s"'<>]+$/.test(url)) continue;
    out.push({ name, price: Math.round(price * 100) / 100, url });
    if (out.length === 4) break;
  }
  return out;
}

// Artists can add their own tip link when going live (or Otto adds it per artist in
// admin-rewards.html). Only well known tip sites are shown as a button, so a bad
// link can't pose as an Asteroid tip.
export const ARTIST_TIP_HOSTS = ["paypal.me", "paypal.com", "ko-fi.com", "cash.app", "venmo.com", "buymeacoffee.com", "patreon.com"];
export function safeTipLink(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!/^https:\/\/\S+$/.test(s)) return "";
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return ARTIST_TIP_HOSTS.some((h) => host === h || host.endsWith("." + h)) ? u.toString() : "";
  } catch (e) {
    return "";
  }
}
export function artistTipLink(roomData) {
  return safeTipLink(roomData && roomData.donationEmbed);
}

/** Config entry for an artist name (case insensitive): {id, name, emailKey, tipLink} or null. */
export function findArtist(cfg, name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  for (const [id, a] of Object.entries((cfg && cfg.artists) || {})) {
    if (a && String(a.name || "").trim().toLowerCase() === n) {
      return { id, name: String(a.name).trim(), emailKey: String(a.emailKey || ""), tipLink: String(a.tipLink || "") };
    }
  }
  return null;
}

/**
 * The artist's own tip link (PayPal, Ko-fi...) for the "Tip directly" button.
 * 1. the link saved for that artist in admin
 * 2. the link the host typed when going live, when the show has one artist
 *    or the host's account is that artist's
 */
export function directTipLink(name, show, roomData, cfg) {
  const a = findArtist(cfg, name);
  const own = a ? safeTipLink(a.tipLink) : "";
  if (own) return own;
  const roomLink = artistTipLink(roomData);
  if (!roomLink) return "";
  if (!show || !show.artists || show.artists.length <= 1) return roomLink;
  const host = roomData && typeof roomData.hostEmailKey === "string" ? roomData.hostEmailKey.trim() : "";
  return a && a.emailKey && host && a.emailKey === host ? roomLink : "";
}

export const MAX_SHOW_ARTISTS = 8;

/** Clean list of artist names: trimmed, no duplicates (any case), at most MAX_SHOW_ARTISTS. */
export function cleanArtistList(raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : typeof raw === "string" ? [raw] : [];
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const n = typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
    if (out.length === MAX_SHOW_ARTISTS) break;
  }
  return out;
}

/** "Nova", "Nova & Luna", "Nova, Luna & Kai". */
export function artistsLabel(list) {
  const a = (list || []).filter(Boolean);
  if (a.length <= 1) return a[0] || "";
  return a.slice(0, -1).join(", ") + " & " + a[a.length - 1];
}

export function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
}

export function firebaseDb() {
  return getDatabase(firebaseApp());
}

/** Rewards key for an email. The RTDB rules compute the same value from auth.token.email. */
export function rewardsKey(email) {
  return String(email || "").trim().toLowerCase().replace(/\./g, "_");
}

export function anonId() {
  let k = "";
  try { k = localStorage.getItem("concertAnonId") || ""; } catch (e) {}
  if (!k) {
    k = "a_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    try { localStorage.setItem("concertAnonId", k); } catch (e) {}
  }
  return k;
}

/** The app's existing account key (emailKey) used by FOLLOWS / FOLLOWING. */
export function appEmailKey() {
  try {
    const ek = (localStorage.getItem("emailKey") || "").trim();
    if (ek) return ek;
    const id = (localStorage.getItem("CurrentUser") || localStorage.getItem("email") || "").trim();
    if (!id || id === "null" || id === "undefined") return "";
    return id.replace(/[.#$[\]/]/g, "_");
  } catch (e) {
    return "";
  }
}

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function fmtPts(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

export function ptsToUsd(pts) {
  return "$" + ((Number(pts) || 0) / POINTS_PER_USD).toFixed(2);
}

/** Lowercase letters, digits and underscores (safe for Stripe client_reference_id). */
export function refSlug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

/** "$5" for whole dollars, "$5.50" otherwise. */
export function ptsToUsdShort(pts) {
  const cents = Math.round(((Number(pts) || 0) / POINTS_PER_USD) * 100);
  return "$" + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
}

export function centsToUsd(cents) {
  return "$" + ((Number(cents) || 0) / 100).toFixed(2);
}

export function splitCents(cents, cfg) {
  const c = Math.max(0, Math.round(Number(cents) || 0));
  const rewards = Math.round((c * cfg.rewardsSharePct) / 100);
  const asteroid = Math.round((c * cfg.asteroidSharePct) / 100);
  return { artist: c - rewards - asteroid, rewards, asteroid };
}

export function tipPoints(cents, cfg) {
  return Math.floor(((Number(cents) || 0) * cfg.pointsPerDollar) / 100);
}

// Streak days follow US Eastern time because most fans are in the US.
const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});
export function showDay(ms) {
  return DAY_FMT.format(new Date(ms));
}

export function listShows(schedule) {
  const out = [];
  if (!schedule || typeof schedule !== "object") return out;
  for (const [id, s] of Object.entries(schedule)) {
    if (!s || typeof s !== "object") continue;
    const startsAt = Number(s.startsAt);
    const endsAt = Number(s.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) continue;
    if (!ROOMS.includes(s.room)) continue;
    let artists = cleanArtistList(s.artists);
    if (!artists.length) artists = cleanArtistList([String(s.artist || "")]);
    out.push({ id, room: s.room, artist: artistsLabel(artists), artists, startsAt, endsAt });
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

/** True when the host has a stream embedded in the room (same rule as liveroomN.html). */
export function streamIsLive(roomData, now = Date.now()) {
  if (!roomData || typeof roomData !== "object") return false;
  const embed = roomData.embed ? String(roomData.embed).trim() : "";
  if (!embed) return false;
  const startedAt = Number(roomData.startedAt) || 0;
  return !(startedAt > 0 && now - startedAt > STREAM_MAX_MS);
}

/** LIVE when a stream is embedded or a scheduled show is inside its time window. */
export function roomStatus(room, roomData, shows, now = Date.now()) {
  const streamLive = streamIsLive(roomData, now);
  const current = shows.find((s) => s.room === room && s.startsAt <= now && now <= s.endsAt) || null;
  const next = shows.find((s) => s.room === room && s.startsAt > now) || null;
  return { live: streamLive || !!current, streamLive, current, next };
}

/**
 * Points balance and streak for one fan.
 * input = {schedule, attendance, tips, adjust, redemptions} (raw RTDB values)
 */
export function computeRewards(input, cfg, now = Date.now()) {
  const shows = listShows(input && input.schedule);
  const byId = new Map(shows.map((s) => [s.id, s]));
  const attendance = (input && input.attendance) || {};
  const attendedIds = Object.keys(attendance).filter((id) => byId.has(id));
  const attendedDays = new Set(attendedIds.map((id) => showDay(byId.get(id).startsAt)));

  // Show days that have started. A missed day only breaks the streak once all its shows ended.
  const days = new Map();
  for (const s of shows) {
    if (s.startsAt > now) continue;
    const d = showDay(s.startsAt);
    const ended = s.endsAt < now;
    days.set(d, days.has(d) ? days.get(d) && ended : ended);
  }
  let streak = 0;
  let bonuses = 0;
  for (const d of [...days.keys()].sort()) {
    if (attendedDays.has(d)) {
      streak += 1;
      if (streak % cfg.streakDays === 0) bonuses += 1;
    } else if (days.get(d)) {
      streak = 0;
    }
  }

  let tipCents = 0;
  let tipPts = 0;
  for (const t of Object.values((input && input.tips) || {})) {
    const c = Math.max(0, Number(t && t.amountCents) || 0);
    tipCents += c;
    tipPts += tipPoints(c, cfg);
  }
  let adjustPts = 0;
  for (const a of Object.values((input && input.adjust) || {})) {
    adjustPts += Math.round(Number(a && a.points) || 0);
  }
  let spent = 0;
  let pending = 0;
  for (const r of Object.values((input && input.redemptions) || {})) {
    if (!r || r.status === "rejected") continue;
    const p = Math.max(0, Math.floor(Number(r.points) || 0));
    spent += p;
    if (r.status === "pending") pending += p;
  }
  const showPts = attendedIds.length * cfg.pointsPerShow;
  const streakPts = bonuses * cfg.streakBonusPoints;
  const earned = showPts + tipPts + streakPts + adjustPts;
  return {
    balance: earned - spent,
    earned, spent, pending,
    showPts, tipPts, streakPts, adjustPts, tipCents,
    attendedShows: attendedIds.length,
    streak,
    streakProgress: streak % cfg.streakDays,
    streakBonuses: bonuses,
  };
}

/** "Today 8:00 PM", "Tomorrow 8:00 PM" or "Sat, Oct 10, 8:00 PM" in the viewer's time zone. */
export function fmtWhen(ms, now = Date.now()) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayKey = (x) => x.toDateString();
  const today = new Date(now);
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
  if (dayKey(d) === dayKey(today)) return "Today " + time;
  if (dayKey(d) === dayKey(tomorrow)) return "Tomorrow " + time;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + ", " + time;
}
