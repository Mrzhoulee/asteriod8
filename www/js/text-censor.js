/**
 * Lightweight client-side profanity filter for chat / sticky notes.
 * Not exhaustive; pair with moderation for production.
 */
const BAD = new Set(
  [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "dick",
    "cock",
    "pussy",
    "cunt",
    "slut",
    "whore",
    "fag",
    "nigger",
    "nigga",
    "retard",
    "rape",
  ].map((w) => w.toLowerCase())
);

function maskWord(w) {
  if (w.length <= 2) return "*".repeat(w.length);
  return w[0] + "*".repeat(Math.max(2, w.length - 2)) + w[w.length - 1];
}

export function censorProfanity(input) {
  if (input == null) return "";
  let s = String(input).slice(0, 2000);
  const parts = s.split(/(\s+|[.,!?;:'"()[\]{}])/);
  return parts
    .map((token) => {
      const core = token.replace(/[^a-zA-Z']/g, "").toLowerCase();
      if (!core || !BAD.has(core)) return token;
      return maskWord(token.replace(/[^a-zA-Z']/g, "") || token);
    })
    .join("");
}

export function hasProfanity(input) {
  const c = censorProfanity(input);
  return c !== String(input || "");
}
