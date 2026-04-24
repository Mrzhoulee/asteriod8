/**
 * Home feed: songs uploaded by artists the viewer follows.
 * Mirrors followed-notices.js: reads FOLLOWING + SONGS and renders playable rows.
 * Uses window.firebaseDatabase, firebaseRef, firebaseGet, firebaseOnValue.
 */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function sanitizeKeyPart(s) {
  return String(s || "").replace(/[.#$[\]]/g, "_");
}

function viewerFollowKey() {
  const ek = (localStorage.getItem("emailKey") || "").trim();
  if (ek) return ek;
  const cu = (localStorage.getItem("CurrentUser") || "").trim();
  const em = (localStorage.getItem("email") || "").trim();
  const id = cu || em;
  if (id) return sanitizeKeyPart(id);
  return "";
}

export async function initFollowedArtistSongs() {
  const db = window.firebaseDatabase;
  const refFn = window.firebaseRef;
  const getFn = window.firebaseGet;
  const onValue = window.firebaseOnValue;
  const mount = document.getElementById("followedSongsMount");
  if (!db || !refFn || !getFn || !onValue || !mount) return;

  function renderEmpty(msg) {
    mount.innerHTML = `<p class="fan-feed-empty">${esc(msg)}</p>`;
  }

  const profileNameCache = new Map();
  async function artistNameForKey(artistKey, fallback) {
    if (profileNameCache.has(artistKey)) return profileNameCache.get(artistKey);
    let label = fallback || artistKey.replace(/_/g, ".").slice(0, 48);
    try {
      const ps = await getFn(refFn(db, "PROFILES/" + artistKey));
      if (ps.exists()) {
        const p = ps.val();
        if (p && p.nickname && String(p.nickname).trim()) label = String(p.nickname).trim().slice(0, 80);
      }
    } catch (e) { /* ignore */ }
    profileNameCache.set(artistKey, label);
    return label;
  }

  async function profileEmailForKey(artistKey) {
    try {
      const ps = await getFn(refFn(db, "PROFILES/" + artistKey));
      if (ps.exists()) {
        const p = ps.val() || {};
        return String(p.email || "").trim();
      }
    } catch (e) { /* ignore */ }
    return "";
  }

  let gen = 0;
  let unbind = null;

  function bind() {
    if (typeof unbind === "function") { unbind(); unbind = null; }
    const vk = viewerFollowKey();
    if (!vk) {
      renderEmpty("Sign in, then follow an artist to see their songs here.");
      return;
    }
    const fRef = refFn(db, "FOLLOWING/" + vk);
    unbind = onValue(fRef, async (snap) => {
      const myGen = ++gen;
      try {
        if (!snap.exists()) { renderEmpty("Follow an artist to see their songs here."); return; }
        const artistKeys = [];
        snap.forEach((c) => { if (c.val() === true) artistKeys.push(c.key); });
        if (!artistKeys.length) { renderEmpty("Follow an artist to see their songs here."); return; }

        mount.innerHTML = `<p class="fan-feed-empty">Loading tracks…</p>`;

        // Build uploader-key match set: PROFILES key + sanitized profile.email variants.
        const matchKeys = new Set();
        for (const ak of artistKeys) {
          matchKeys.add(ak);
          const em = await profileEmailForKey(ak);
          if (em) {
            matchKeys.add(em);
            matchKeys.add(sanitizeKeyPart(em));
            matchKeys.add(sanitizeKeyPart(em.toLowerCase()));
          }
        }

        const songsSnap = await getFn(refFn(db, "SONGS"));
        if (!songsSnap.exists()) { renderEmpty("No songs uploaded by people you follow yet."); return; }
        const all = songsSnap.val();
        const matches = [];
        for (const titleKey in all) {
          for (const albumKey in all[titleKey]) {
            for (const artistKeyInner in all[titleKey][albumKey]) {
              const s = all[titleKey][albumKey][artistKeyInner];
              if (!s || !s.fileInp) continue;
              const up = String(s.uploader || "").trim();
              if (!up) continue;
              if (
                matchKeys.has(up) ||
                matchKeys.has(sanitizeKeyPart(up)) ||
                matchKeys.has(sanitizeKeyPart(up.toLowerCase()))
              ) {
                // Figure out which artist this song belongs to, for name lookup.
                let ownerKey = sanitizeKeyPart(up);
                if (!artistKeys.includes(ownerKey)) {
                  for (const ak of artistKeys) if (matchKeys.has(up) && ak) { ownerKey = ak; break; }
                }
                matches.push({
                  ownerKey,
                  title: s.title || titleKey.replace(/_/g, " "),
                  artist: s.artist || "",
                  album: s.album || "",
                  src: s.fileInp,
                  imageUrl: s.imageUrl || "",
                  createdAt: s.createdAt || 0,
                  uploaderName: s.uploaderName || "",
                });
              }
            }
          }
        }
        if (myGen !== gen) return;
        if (!matches.length) { renderEmpty("No songs uploaded by people you follow yet."); return; }
        matches.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const top = matches.slice(0, 30);

        const rows = await Promise.all(top.map(async (m) => {
          const displayArtist = m.artist || m.uploaderName || await artistNameForKey(m.ownerKey, "");
          return { ...m, displayArtist };
        }));

        if (myGen !== gen) return;
        mount.innerHTML = rows.map((m, i) => `
          <div class="followed-song-row" data-i="${i}">
            <div class="followed-song-info">
              <div class="followed-song-title">${esc(m.title)}</div>
              <div class="followed-song-meta">${esc(m.displayArtist)}${m.album ? " · " + esc(m.album) : ""}</div>
            </div>
            <div class="followed-song-actions">
              <button class="followed-song-btn" data-action="play" aria-label="Play">▶</button>
              <button class="followed-song-btn" data-action="queue" aria-label="Add to queue">＋</button>
            </div>
          </div>`).join("");
        mount.querySelectorAll(".followed-song-row").forEach((row) => {
          const i = Number(row.dataset.i || 0);
          const m = rows[i];
          const payload = { url: m.src, src: m.src, title: m.title, artist: m.displayArtist, imageUrl: m.imageUrl };
          row.querySelector('[data-action="play"]').addEventListener("click", () => {
            if (window.AsteroidPlayer) window.AsteroidPlayer.play(payload);
          });
          row.querySelector('[data-action="queue"]').addEventListener("click", () => {
            if (window.AsteroidPlayer) window.AsteroidPlayer.enqueue(payload);
          });
        });
      } catch (e) {
        console.warn("[followed-songs]", e);
        if (myGen === gen) renderEmpty("Could not load tracks.");
      }
    });
  }

  bind();
  const auth = window.firebaseAuth;
  if (auth) {
    try { onAuthStateChanged(auth, () => bind()); } catch (e) {}
  }
}
