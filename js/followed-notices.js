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

      // Resolve feat_* keys → real ownerKeys via ARTIST_PROFILES + AGREEMENTS,
      // so static featured artists' posts appear when their dashboard owner posts.
      const profiles = window.ARTIST_PROFILES || {};
      let agreementsCache = null;
      const getAgreements = async () => {
        if (agreementsCache !== null) return agreementsCache;
        try {
          const ag = await getFn(refFn(db, "AGREEMENTS"));
          agreementsCache = ag.exists() ? (ag.val() || {}) : {};
        } catch (e) { agreementsCache = {}; }
        return agreementsCache;
      };

      // Build [{ readKey, displayKey, fallbackName }]:
      // readKey = where ARTIST_NOTICES are stored
      // displayKey = the key in FOLLOWING (used for caching display name)
      const noticeTargets = [];
      for (const ak of artistKeys) {
        if (!ak.startsWith("feat_")) {
          noticeTargets.push({ readKey: ak, displayKey: ak, fallbackName: "" });
          continue;
        }
        const artistId = ak.slice(5);
        const profileName = (profiles[artistId] && profiles[artistId].name) ? String(profiles[artistId].name).trim() : "";
        // Always also try the literal artistId (in case notices were posted by that key directly)
        noticeTargets.push({ readKey: artistId, displayKey: ak, fallbackName: profileName });
        if (profileName) {
          const ags = await getAgreements();
          const wanted = profileName.toLowerCase();
          for (const k in ags) {
            const a = ags[k] || {};
            const nm = String(a.name || "").trim().toLowerCase();
            if (nm && nm === wanted) noticeTargets.push({ readKey: k, displayKey: ak, fallbackName: profileName });
          }
        }
      }

      const all = [];
      const seenIds = new Set();
      for (const tgt of noticeTargets) {
        try {
          const ns = await getFn(refFn(db, "ARTIST_NOTICES/" + tgt.readKey));
          if (!ns.exists()) continue;
          const name = tgt.fallbackName || await artistDisplayName(tgt.readKey);
          ns.forEach((ch) => {
            const v = ch.val();
            const dedupKey = tgt.readKey + "|" + ch.key;
            if (seenIds.has(dedupKey)) return;
            if (v && typeof v.text === "string") {
              seenIds.add(dedupKey);
              all.push({
                artistKey: tgt.displayKey,
                artistName: name,
                id: ch.key,
                text: v.text,
                ts: v.ts || 0,
              });
            }
          });
        } catch (e) {
          console.warn("notices for", tgt.readKey, e);
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

      // Surface a popup for any unseen announcements (anything posted after
      // the last time the viewer opened the feed). Tracked per-viewer in
      // localStorage so the popup only fires for genuinely new posts.
      try { showAnnouncementPopup(top, vk); } catch (e) { console.warn("[followed-notices] popup", e); }
    } catch (e) {
      console.error(e);
      if (myGen === gen) renderEmpty("Could not load updates.");
    }
    });
  }

  // Show a coral-styled popup over the page for any announcement the viewer
  // hasn't seen yet. Stack new ones; auto-dismiss after 8s; tap to close.
  function showAnnouncementPopup(notices, viewerKey) {
    if (!Array.isArray(notices) || !notices.length || !viewerKey) return;
    const lsKey = "noticeSeen_" + viewerKey;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(lsKey) || "{}") || {}; } catch (e) { seen = {}; }

    // First-ever load: don't blast every existing post; just mark them all as seen.
    if (!seen.__bootstrapped) {
      const initial = { __bootstrapped: 1 };
      notices.forEach((n) => { initial[n.artistKey + "|" + n.id] = 1; });
      try { localStorage.setItem(lsKey, JSON.stringify(initial)); } catch (e) {}
      return;
    }

    const fresh = notices.filter((n) => !seen[n.artistKey + "|" + n.id]).slice(0, 3);
    if (!fresh.length) return;

    let host = document.getElementById("followedNoticePopupHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "followedNoticePopupHost";
      host.style.cssText = "position:fixed;top:max(14px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:10px;width:min(440px,calc(100% - 24px));pointer-events:none;";
      document.body.appendChild(host);
    }

    fresh.forEach((n) => {
      const card = document.createElement("div");
      card.setAttribute("role", "alert");
      card.style.cssText = "pointer-events:auto;background:linear-gradient(135deg,#ff7f50,#e66a3a);color:#0a0a0a;padding:14px 16px;border-radius:14px;box-shadow:0 14px 32px rgba(255,127,80,0.45),0 0 0 1px rgba(255,255,255,0.18) inset;font-family:'Poppins',system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;line-height:1.4;cursor:pointer;transform:translateY(-12px);opacity:0;transition:opacity .25s ease,transform .25s ease;display:flex;gap:10px;align-items:flex-start;";
      const headLine = document.createElement("div");
      headLine.style.cssText = "flex:1;min-width:0;";
      headLine.innerHTML =
        '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-bottom:4px;">New from ' + esc(n.artistName) + '</div>' +
        '<div style="font-weight:700;color:#0a0a0a;white-space:normal;word-break:break-word;">' + esc(n.text.length > 160 ? n.text.slice(0, 160) + "…" : n.text) + '</div>';
      const closeBtn = document.createElement("button");
      closeBtn.setAttribute("aria-label", "Dismiss");
      closeBtn.textContent = "×";
      closeBtn.style.cssText = "background:rgba(0,0,0,0.18);border:none;color:#0a0a0a;width:24px;height:24px;border-radius:12px;font-size:18px;font-weight:700;line-height:1;cursor:pointer;flex-shrink:0;";
      const dismiss = () => {
        card.style.opacity = "0";
        card.style.transform = "translateY(-12px)";
        setTimeout(() => { try { card.remove(); } catch (e) {} }, 250);
      };
      card.appendChild(headLine);
      card.appendChild(closeBtn);
      closeBtn.addEventListener("click", (ev) => { ev.stopPropagation(); dismiss(); });
      card.addEventListener("click", () => {
        const sec = document.getElementById("followedNoticesSection");
        if (sec && typeof sec.scrollIntoView === "function") sec.scrollIntoView({ behavior: "smooth", block: "start" });
        dismiss();
      });
      host.appendChild(card);
      requestAnimationFrame(() => { card.style.opacity = "1"; card.style.transform = "translateY(0)"; });
      setTimeout(dismiss, 8000);
    });

    fresh.forEach((n) => { seen[n.artistKey + "|" + n.id] = 1; });
    seen.__bootstrapped = 1;
    try { localStorage.setItem(lsKey, JSON.stringify(seen)); } catch (e) {}
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
