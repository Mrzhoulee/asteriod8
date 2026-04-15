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

function truthyExplicitValue(v) {
  if (v === true || v === 1) return true;
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return false;
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "explicit" || s === "e";
}

function songExplicitMetadataFlags(song) {
  if (!song || typeof song !== "object") return false;
  const keys = ["isExplicit", "explicit", "explicitLanguage", "explicitTrack", "parentalAdvisory"];
  for (const k of keys) {
    if (truthyExplicitValue(song[k])) return true;
  }
  const cr = String(song.contentRating || song.rating || "").trim().toLowerCase();
  if (cr === "explicit" || cr === "mature") return true;
  const tags = song.tags;
  if (Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === "explicit")) return true;
  if (typeof tags === "string" && tags.toLowerCase().includes("explicit")) return true;
  return false;
}

function catalogExplicitFromStrings(song) {
  if (!song || typeof song !== "object") return false;
  const blob = [song.title, song.artist, song.album, song.version, song.subtitle, song.originalTitle]
    .filter(Boolean)
    .map(String)
    .join("\n");
  if (!blob.trim()) return false;
  return (
    /\(\s*explicit\s*\)|\[\s*explicit\s*\]|\bexplicit\s+version\b|\bexplicit\s+content\b/i.test(blob) ||
    /\(\s*e\s*\)\s*$/i.test(blob.trim()) ||
    /\s-\s*e\s*$/i.test(blob.trim())
  );
}

export function songShowsExplicitBadge(song) {
  if (!song || typeof song !== "object") return false;
  if (songExplicitMetadataFlags(song)) return true;
  if (catalogExplicitFromStrings(song)) return true;
  return songMetadataExplicit(song);
}
