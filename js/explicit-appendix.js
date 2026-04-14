/**
 * Appendix-style explicit language check (fictional / placeholder list).
 * Used for song metadata (title, artist, album) and sticky-note text.
 */

const RAW_TERMS = [
  "arse",
  "arsehead",
  "arsehole",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bloody",
  "bollocks",
  "brotherfucker",
  "bugger",
  "bullshit",
  "child-fucker",
  "cock",
  "cocksucker",
  "crap",
  "cunt",
  "dammit",
  "damn",
  "damned",
  "dick",
  "dick-head",
  "dickhead",
  "dumb-ass",
  "dumbass",
  "dyke",
  "fag",
  "faggot",
  "father-fucker",
  "fatherfucker",
  "fuck",
  "fucked",
  "fucker",
  "fucking",
  "goddammit",
  "goddamn",
  "goddamned",
  "goddamnit",
  "godsdamn",
  "hell",
  "horseshit",
  "jack-ass",
  "jackass",
  "kike",
  "mother-fucker",
  "motherfucker",
  "nigga",
  "nigra",
  "pigfucker",
  "piss",
  "prick",
  "pussy",
  "shit",
  "shite",
  "sisterfuck",
  "sisterfucker",
  "slut",
  "spastic",
  "tranny",
  "twat",
  "wanker",
];

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termToPattern(term) {
  const t = String(term).trim().toLowerCase();
  if (!t) return null;
  if (t.includes("-")) {
    const parts = t.split("-").filter(Boolean);
    if (parts.length < 2) return `\\b${escapeRe(t.replace(/-/g, ""))}\\b`;
    return `\\b${parts.map(escapeRe).join("[-\\s]+")}\\b`;
  }
  return `\\b${escapeRe(t)}\\b`;
}

function buildAppendixRegex() {
  const seen = new Set();
  const patterns = [];
  for (const raw of RAW_TERMS) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const p = termToPattern(key);
    if (p) patterns.push(p);
  }
  patterns.sort((a, b) => b.length - a.length);
  return new RegExp(patterns.join("|"), "i");
}

const APPENDIX_REGEX = buildAppendixRegex();

export function textContainsAppendixExplicit(text) {
  if (text == null) return false;
  const s = String(text);
  if (!s.trim()) return false;
  return APPENDIX_REGEX.test(s);
}

export function songMetadataExplicit(song) {
  if (!song || typeof song !== "object") return false;
  const blob = [song.title, song.artist, song.album].filter(Boolean).map(String).join("\n");
  return textContainsAppendixExplicit(blob);
}

export function songShowsExplicitBadge(song) {
  if (!song || typeof song !== "object") return false;
  const flag = song.isExplicit;
  if (flag === true || flag === 1 || flag === "1" || String(flag).toLowerCase() === "true") return true;
  return songMetadataExplicit(song);
}
