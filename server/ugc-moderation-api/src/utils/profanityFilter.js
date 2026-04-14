/**
 * Keyword-based profanity / abuse screening for titles, descriptions, comments.
 * Severe hits should block posting; mild hits can flag for review (caller decides).
 */

const SEVERE = [
  /\b(k[i1]ll\s*yourself|kys)\b/i,
  /\b(n[i1]g{2,}er|n[i1]gg[a@])\b/i,
  /\b(f[a@]gg[o0]t)\b/i,
  /\b(child\s*p[o0]rn|cp\s*link)\b/i,
];

const MILD = [
  /\b(f+u+c+k+|s+h+i+t+)\b/i,
  /\b(b+i+t+c+h+)\b/i,
  /\b(a+s+s+h+o+l+e+)\b/i,
];

/**
 * @param {string} text
 * @returns {{ ok: boolean, blocked: boolean, flagged: boolean, severeMatches: string[], mildMatches: string[] }}
 */
function analyzeText(text) {
  const raw = String(text || "");
  if (!raw.trim()) {
    return { ok: true, blocked: false, flagged: false, severeMatches: [], mildMatches: [] };
  }

  const severeMatches = [];
  for (const re of SEVERE) {
    const m = raw.match(re);
    if (m) severeMatches.push(m[0]);
  }

  const mildMatches = [];
  for (const re of MILD) {
    const m = raw.match(re);
    if (m) mildMatches.push(m[0]);
  }

  const blocked = severeMatches.length > 0;
  const flagged = mildMatches.length > 0 && !blocked;

  return {
    ok: !blocked,
    blocked,
    flagged,
    severeMatches,
    mildMatches,
  };
}

module.exports = { analyzeText, SEVERE, MILD };
