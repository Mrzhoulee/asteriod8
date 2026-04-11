/**
 * Home feed: updates from artists the viewer follows (FOLLOWING + ARTIST_NOTICES).
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

/** Matches index.html getViewerFollowKeyForFollow: signed-in users use emailKey / account id, not anonymous poll id. */
function viewerFollowKey() {
  const ek = (localStorage.getItem("emailKey") || "").trim();
  if (ek) return ek;
  const cu = (localStorage.getItem("CurrentUser") || "").trim();
  const em = (localStorage.getItem("email") || "").trim();
  const id = cu || em;
  if (id) return sanitizeKeyPart(id);
  let pk = localStorage.getItem("pollVoterKey");
  if (!pk) {
    pk = "pv_" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("pollVoterKey", pk);
  }
  return sanitizeKeyPart(pk);
}

export async function initFollowedArtistNotices() {
  const db = window.firebaseDatabase;
  const refFn = window.firebaseRef;
  const getFn = window.firebaseGet;
  const onValue = window.firebaseOnValue;
  const mount = document.getElementById("followedNoticesMount");
  if (!db || !refFn || !getFn || !onValue || !mount) return;

  const nameCache = new Map();

  async function artistDisplayName(artistKey) {
    if (nameCache.has(artistKey)) return nameCache.get(artistKey);
    let label = artistKey.replace(/_/g, ".").slice(0, 48);
    try {
      const ps = await getFn(refFn(db, "PROFILES/" + artistKey));
      if (ps.exists()) {
        const p = ps.val();
        const n = (p && (p.nickname || p.bio)) || null;
        if (n && String(n).trim()) label = String(n).trim().slice(0, 80);
      }
    } catch (e) {
      console.warn("profile name", e);
    }
    nameCache.set(artistKey, label);
    return label;
  }

  function renderEmpty(msg) {
    mount.innerHTML = `<p class="fan-feed-empty">${esc(msg)}</p>`;
  }

  let gen = 0;
  let unfollow = null;

  function bindFollowingListener() {
    if (typeof unfollow === "function") {
      unfollow();
      unfollow = null;
    }
    const vk = viewerFollowKey();
    const fRef = refFn(db, "FOLLOWING/" + vk);

    unfollow = onValue(fRef, async (snap) => {
    const myGen = ++gen;
    try {
      if (!snap.exists()) {
        const signedHint =
          (localStorage.getItem("emailKey") || "").trim() ||
          (localStorage.getItem("CurrentUser") || "").trim() ||
          (localStorage.getItem("email") || "").trim() ||
          (window.firebaseAuth && window.firebaseAuth.currentUser);
        renderEmpty(
          signedHint
            ? "Open an artist’s profile and tap Follow to see their posts here."
            : "Sign in with Apple, open an artist’s profile, then tap Follow to see updates here."
        );
        return;
      }
      const artistKeys = [];
      snap.forEach((c) => {
        if (c.val() === true) artistKeys.push(c.key);
      });
      if (!artistKeys.length) {
        renderEmpty("Follow artists from their profile to see news here.");
        return;
      }

      const all = [];
      for (const ak of artistKeys) {
        try {
          const ns = await getFn(refFn(db, "ARTIST_NOTICES/" + ak));
          if (!ns.exists()) continue;
          const name = await artistDisplayName(ak);
          ns.forEach((ch) => {
            const v = ch.val();
            if (v && typeof v.text === "string") {
              all.push({
                artistKey: ak,
                artistName: name,
                id: ch.key,
                text: v.text,
                ts: v.ts || 0,
              });
            }
          });
        } catch (e) {
          console.warn("notices for", ak, e);
        }
      }

      all.sort((a, b) => b.ts - a.ts);
      const top = all.slice(0, 30);
      if (!top.length) {
        renderEmpty("No posts yet from people you follow — check back later.");
        return;
      }

      if (myGen !== gen) return;
      mount.innerHTML = top
        .map(
          (n) => `
        <article class="fan-feed-card">
          <div class="fan-feed-card-head">
            <span class="fan-feed-artist">${esc(n.artistName)}</span>
            <time class="fan-feed-time">${n.ts ? new Date(n.ts).toLocaleString() : ""}</time>
          </div>
          <p class="fan-feed-text">${esc(n.text)}</p>
        </article>`
        )
        .join("");
    } catch (e) {
      console.error(e);
      if (myGen === gen) renderEmpty("Could not load updates.");
    }
    });
  }

  bindFollowingListener();
  const auth = window.firebaseAuth;
  if (auth) {
    try {
      onAuthStateChanged(auth, () => {
        bindFollowingListener();
      });
    } catch (e) {
      console.warn("followed notices auth hook", e);
    }
  }
}
