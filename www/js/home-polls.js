/**
 * Home page artist vs artist polls (ARTIST_POLLS).
 * Uses window.firebaseDatabase, firebaseRef, firebaseGet, firebaseSet, firebaseOnValue.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function sanitizeEmail(email) {
  return String(email || "").replace(/[.#$[\]]/g, "_");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function getPollVoterId() {
  let vid = sanitizeEmail((localStorage.getItem("email") || "").trim());
  if (!vid) {
    let pk = localStorage.getItem("pollVoterKey");
    if (!pk) {
      pk = "pv_" + Math.random().toString(36).slice(2) + Date.now();
      localStorage.setItem("pollVoterKey", pk);
    }
    vid = sanitizeEmail(pk);
  }
  return vid;
}

function countVotes(votesObj) {
  let ca = 0;
  let cb = 0;
  if (!votesObj || typeof votesObj !== "object") return { ca, cb };
  Object.keys(votesObj).forEach((k) => {
    const x = votesObj[k];
    if (!x || typeof x !== "object") return;
    if (x.side === "a") ca++;
    else if (x.side === "b") cb++;
  });
  return { ca, cb };
}

export function pollPreviewMarkup(url) {
  const u = String(url || "").trim();
  if (!u) return '<div class="home-poll-no-prev">No preview link</div>';
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    return `<div class="home-poll-embed"><iframe title="YouTube preview" loading="lazy" src="https://www.youtube.com/embed/${yt[1]}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const sp = u.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/i);
  if (sp) {
    return `<div class="home-poll-embed home-poll-embed--spotify"><iframe title="Spotify preview" loading="lazy" src="https://open.spotify.com/embed/${sp[1]}/${sp[2]}" allow="encrypted-media"></iframe></div>`;
  }
  if (/soundcloud\.com/i.test(u)) {
    return `<div class="home-poll-embed home-poll-embed--sc"><iframe title="SoundCloud preview" loading="lazy" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23ff5500"></iframe></div>`;
  }
  if (/music\.apple\.com/i.test(u)) {
    return `<div class="home-poll-linkout"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="home-poll-ext">Open in Apple Music</a></div>`;
  }
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(u) || u.startsWith("blob:")) {
    return `<div class="home-poll-audio"><audio controls preload="none" src="${esc(u)}"></audio></div>`;
  }
  return `<div class="home-poll-linkout"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="home-poll-ext">Open preview link</a></div>`;
}

function cardHtml(p) {
  const colorA = p.colorA || "#2563eb";
  const colorB = p.colorB || "#dc2626";
  const { ca, cb } = countVotes(p.votes);
  const labelA = esc(p.labelA || "Artist A");
  const labelB = esc(p.labelB || p.artistBName || "Artist B");
  const pid = esc(p.id);
  return `
  <article class="home-poll-card" style="--poll-a:${esc(colorA)};--poll-b:${esc(colorB)};" data-poll-id="${pid}">
    <div class="home-poll-card-head">
      <span class="home-poll-tag" style="background:${esc(colorA)}">${labelA}</span>
      <span class="home-poll-vs">vs</span>
      <span class="home-poll-tag" style="background:${esc(colorB)}">${labelB}</span>
    </div>
    <div class="home-poll-duo">
      <div class="home-poll-side home-poll-side--a">
        ${pollPreviewMarkup(p.songUrlA)}
        <button type="button" class="home-poll-vote-btn" data-home-poll-vote data-poll-id="${pid}" data-side="a" style="background:${esc(colorA)}">Vote · ${ca}</button>
      </div>
      <div class="home-poll-side home-poll-side--b">
        ${pollPreviewMarkup(p.songUrlB)}
        <button type="button" class="home-poll-vote-btn" data-home-poll-vote data-poll-id="${pid}" data-side="b" style="background:${esc(colorB)}">Vote · ${cb}</button>
      </div>
    </div>
    <p class="home-poll-hint">One vote per week on this device / account.</p>
  </article>`;
}

async function submitVote(db, ref, getFn, setFn, pollId, side) {
  const vid = getPollVoterId();
  const r = ref(db, "ARTIST_POLLS/" + pollId + "/votes/" + vid);
  const now = Date.now();
  try {
    const snap = await getFn(r);
    if (snap.exists()) {
      const prev = snap.val();
      const t = prev && typeof prev.ts === "number" ? prev.ts : 0;
      if (now - t < WEEK_MS) {
        const days = Math.max(1, Math.ceil((WEEK_MS - (now - t)) / (24 * 60 * 60 * 1000)));
        return { ok: false, message: "You already voted recently. Try again in about " + days + " day(s)." };
      }
    }
    await setFn(r, { side, ts: now });
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Could not save vote (rules or network)." };
  }
}

export function initHomePolls() {
  const db = window.firebaseDatabase;
  const refFn = window.firebaseRef;
  const getFn = window.firebaseGet;
  const setFn = window.firebaseSet;
  const onValue = window.firebaseOnValue;
  const mount = document.getElementById("homePollsMount");
  if (!db || !refFn || !getFn || !setFn || !onValue || !mount) return;

  const pollsRef = refFn(db, "ARTIST_POLLS");
  onValue(pollsRef, (snap) => {
    if (!snap.exists()) {
      mount.innerHTML = '<p class="home-polls-empty">No artist battles yet — check back soon.</p>';
      return;
    }
    const rows = [];
    snap.forEach((child) => {
      const v = child.val();
      if (!v || typeof v !== "object") return;
      if (!v.songUrlA || !v.songUrlB) return;
      rows.push({ id: child.key, ...v });
    });
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const lim = rows.slice(0, 12);
    if (!lim.length) {
      mount.innerHTML = '<p class="home-polls-empty">No artist battles yet.</p>';
      return;
    }
    mount.innerHTML = lim.map((p) => cardHtml({ ...p, id: p.id })).join("");

    mount.querySelectorAll("[data-home-poll-vote]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pollId = btn.getAttribute("data-poll-id");
        const side = btn.getAttribute("data-side");
        if (!pollId || (side !== "a" && side !== "b")) return;
        const res = await submitVote(db, refFn, getFn, setFn, pollId, side);
        if (!res.ok) alert(res.message);
      });
    });
  });
}
