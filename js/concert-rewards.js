// Concert room add on (liveroom1-5.html):
//   LIVE pill with a real viewer count (hidden until CONCERT_CONFIG.viewerCountThreshold)
//   first visit survey (fan or artist, fan of who) + 3 intro slides per role
//   points panel: points for watching scheduled shows, tips credited by admin,
//   show day streak bonus, and requests to spend points (gift cards, tips,
//   shoutouts, badges, early access) that Otto fulfils from admin-rewards.html.

import {
  ref, onValue, set, push, update, remove, onDisconnect, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import {
  initializeAuth, getAuth, onAuthStateChanged, browserLocalPersistence, indexedDBLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  firebaseApp, firebaseDb, readConfig, rewardsKey, anonId, appEmailKey, esc, fmtPts, ptsToUsd,
  listShows, roomStatus, computeRewards, fmtWhen, GIFT_CARDS, REDEEM_LABELS, POINTS_PER_USD, ptsToUsdShort, refSlug, artistTipLink,
} from "./concert-rewards-core.js";

const SURVEY_KEY = "astConcertSurvey_v1";

const CSS = `
.crx-pill{display:inline-flex;align-items:center;gap:8px;margin-left:auto;font-size:12px;font-weight:800;letter-spacing:.08em;color:#fff;background:#ff3b3b;padding:6px 12px;border-radius:999px}
.crx-pill[hidden]{display:none}
.crx-pill .crx-dot{width:8px;height:8px;border-radius:50%;background:#fff;animation:crxPulse 1.4s ease-in-out infinite}
.crx-pill .crx-viewers{font-weight:600;letter-spacing:0;opacity:.9;padding-left:8px;border-left:1px solid rgba(255,255,255,.4)}
@keyframes crxPulse{0%,100%{opacity:1}50%{opacity:.3}}
.crx-panel h3{display:flex;align-items:center;justify-content:space-between}
.crx-balance{display:flex;align-items:baseline;gap:6px;margin:4px 0 8px}
.crx-balance b{font-size:30px;font-weight:800;color:#fff;line-height:1}
.crx-balance span{font-size:13px;color:rgba(255,255,255,.6);font-weight:600}
.crx-balance em{font-style:normal;font-size:13px;color:#ff7f50;font-weight:700;margin-left:auto}
.crx-line{display:flex;align-items:center;gap:8px;font-size:12.5px;color:rgba(255,255,255,.75);margin:6px 0}
.crx-line .material-symbols-outlined{font-size:18px;color:#ff7f50}
.crx-flames{display:inline-flex;gap:2px}
.crx-flames i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.15)}
.crx-flames i.on{background:#ff7f50}
.crx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;box-sizing:border-box;padding:12px 16px;border:none;border-radius:12px;background:#ff7f50;color:#fff;font:700 14px Montserrat,system-ui,sans-serif;cursor:pointer;text-decoration:none;margin-top:8px}
.crx-btn:disabled{opacity:.45;cursor:not-allowed}
.crx-btn.tip{background:linear-gradient(90deg,#ff3b3b,#ff7a3b)}
#donationBox{display:none !important}
.crx-shout{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translate(-50%,-160%);z-index:100002;width:min(92vw,460px);box-sizing:border-box;padding:14px 18px;border-radius:16px;background:linear-gradient(135deg,#ff3b3b,#ff7a3b);color:#fff;box-shadow:0 18px 50px rgba(255,90,60,.45);transition:transform .45s cubic-bezier(.2,.9,.3,1.2);font-family:Montserrat,system-ui,sans-serif}
.crx-shout.show{transform:translate(-50%,0)}
.crx-shout b{display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.95}
.crx-shout b .material-symbols-outlined{font-size:18px}
.crx-shout p{margin:6px 0 0;font-size:18px;font-weight:700;line-height:1.35;word-break:break-word}
.crx-shoutlist[hidden]{display:none}
.crx-sh{padding:10px 0;border-top:1px solid rgba(255,255,255,.07)}
.crx-sh:first-of-type{border-top:none}
.crx-sh b{color:#fff;font-size:13px}
.crx-sh span{color:#ff9a73;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-left:8px}
.crx-sh p{margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);line-height:1.45;word-break:break-word}
.crx-support{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
.crx-support-title{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:2px}
.crx-perks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.crx-perks .crx-btn{margin-top:8px;padding:11px 10px;font-size:13px;flex-direction:column;gap:2px}
.crx-perks .crx-btn small{font-weight:600;opacity:.85}
.crx-btn.ghost{background:transparent;border:1px solid rgba(255,127,80,.5);color:#ff9a73}
.crx-btn.done{background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.5);color:#86efac}
.crx-link{background:none;border:none;color:#ff9a73;font:600 12px Montserrat,system-ui,sans-serif;cursor:pointer;padding:4px 0}
.crx-fine{font-size:11px;color:rgba(255,255,255,.45);line-height:1.45;margin:10px 0 0}
.crx-overlay{position:fixed;inset:0;z-index:100000;background:rgba(5,6,10,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));box-sizing:border-box}
@media(min-width:600px){.crx-overlay{align-items:center}}
.crx-modal{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:#15161a;border:1px solid rgba(255,127,80,.3);border-radius:20px;padding:24px 20px 20px;box-sizing:border-box;color:#ececec;font-family:Montserrat,system-ui,sans-serif}
.crx-modal h2{margin:0 0 8px;font-size:22px;line-height:1.25;color:#fff}
.crx-kicker{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#ff7f50}
.crx-sub{margin:0 0 16px;font-size:14px;color:rgba(255,255,255,.6);line-height:1.5}
.crx-close{position:absolute;top:10px;right:10px;background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;padding:6px}
.crx-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.crx-choice button{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 10px;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:#1d1f24;color:#fff;font:700 14px Montserrat,system-ui,sans-serif;cursor:pointer}
.crx-choice button .material-symbols-outlined{font-size:32px;color:#ff7f50}
.crx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.crx-chip{padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:#1d1f24;color:#eee;font:600 13px Montserrat,system-ui,sans-serif;cursor:pointer}
.crx-chip.on{background:rgba(255,127,80,.18);border-color:#ff7f50;color:#fff}
.crx-input{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0e0e12;color:#fff;font:500 15px Montserrat,system-ui,sans-serif;margin:4px 0 0}
.crx-input:focus{outline:none;border-color:#ff7f50}
.crx-label{display:block;font-size:12px;font-weight:600;color:rgba(255,255,255,.6);margin:12px 0 4px}
.crx-slide{text-align:center;padding:8px 4px 4px}
.crx-slide-icon{font-size:52px !important;color:#ff7f50;margin-bottom:10px}
.crx-slide p{font-size:15px;line-height:1.55;color:rgba(255,255,255,.75);margin:0 0 8px}
.crx-slide p.small{font-size:12.5px;color:rgba(255,255,255,.5)}
.crx-logo{width:64px;height:64px;border-radius:16px;object-fit:cover;display:block;margin:0 auto 12px;box-shadow:0 8px 24px rgba(255,127,80,.25)}
.crx-checks{list-style:none;padding:0;margin:12px auto 4px;display:inline-flex;flex-direction:column;gap:8px;text-align:left}
.crx-checks li{display:flex;align-items:center;gap:8px;font-size:14px;color:#fff;font-weight:600}
.crx-checks .material-symbols-outlined{font-size:20px;color:#ff7f50}
.crx-dots{display:flex;justify-content:center;gap:6px;margin:14px 0 4px}
.crx-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.2)}
.crx-dots i.on{background:#ff7f50;width:20px;border-radius:4px}
.crx-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px}
.crx-row .crx-btn{width:auto;flex:1}
.crx-follow{display:flex;flex-direction:column;gap:0;margin:8px 0 4px}
.crx-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 14px;padding-bottom:2px}
.crx-tabs button{flex-shrink:0;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:none;color:rgba(255,255,255,.7);font:600 12.5px Montserrat,system-ui,sans-serif;cursor:pointer}
.crx-tabs button.on{background:#ff7f50;border-color:#ff7f50;color:#fff}
.crx-req{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,.07);font-size:12.5px}
.crx-req small{display:block;color:rgba(255,255,255,.45);margin-top:2px}
.crx-status{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.crx-status.pending{color:#fbbf24}.crx-status.sent{color:#4ade80}.crx-status.rejected{color:#f87171}
.crx-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:100001;background:#1d1f24;border:1px solid #ff7f50;color:#fff;font:600 13px Montserrat,system-ui,sans-serif;padding:11px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:calc(100vw - 32px);text-align:center}
`;

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

function icon(name) {
  return '<span class="material-symbols-outlined" aria-hidden="true">' + name + "</span>";
}

function initAuth(app) {
  try {
    return initializeAuth(app, { persistence: [browserLocalPersistence, indexedDBLocalPersistence] });
  } catch (e) {
    return getAuth(app);
  }
}

function readSurvey() {
  try { return JSON.parse(localStorage.getItem(SURVEY_KEY) || "null"); } catch (e) { return null; }
}

/** @param {number} roomNum 1 to 5 */
export function mountConcertRewards(roomNum) {
  const room = "Room" + roomNum;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const app = firebaseApp();
  const db = firebaseDb();
  const auth = initAuth(app);

  const state = {
    cfg: readConfig(null),
    schedule: null,
    roomData: null,
    viewers: 0,
    user: null,
    key: "",
    mine: { attendance: null, tips: null, adjust: null, redemptions: null },
    writingAttendance: false,
    attendanceRetryAt: 0,
  };
  const shows = () => listShows(state.schedule);
  const status = () => roomStatus(room, state.roomData, shows(), Date.now());
  const rewards = () => computeRewards({ schedule: state.schedule, ...state.mine }, state.cfg);

  // ---- LIVE pill + real viewer count -------------------------------------------
  const head = document.querySelector(".cr-room-head");
  const pill = el("span", "crx-pill");
  pill.hidden = true;
  if (head) head.appendChild(pill);

  function renderPill() {
    const st = status();
    pill.hidden = !st.live;
    if (!st.live) return;
    const showCount = state.viewers >= state.cfg.viewerCountThreshold;
    pill.innerHTML = '<span class="crx-dot"></span>LIVE' +
      (showCount ? '<span class="crx-viewers">' + fmtPts(state.viewers) + " watching</span>" : "");
  }

  const viewerId = appEmailKey() || anonId();
  const presenceRef = ref(db, "CONCERT_PRESENCE/" + room + "/" + viewerId);
  onValue(ref(db, ".info/connected"), (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(presenceRef).remove()
      .then(() => set(presenceRef, serverTimestamp()))
      .catch((e) => console.warn("[rewards] presence", e && e.code));
  });
  window.addEventListener("pagehide", () => { remove(presenceRef).catch(() => {}); });
  onValue(ref(db, "CONCERT_PRESENCE/" + room), (snap) => {
    const v = snap.val();
    const cutoff = Date.now() - 12 * 60 * 60 * 1000; // ignore ghosts if a disconnect was missed
    state.viewers = v && typeof v === "object" ? Object.values(v).filter((t) => typeof t === "number" && t > cutoff).length : 0;
    renderPill();
  }, () => {});

  // ---- Points panel -------------------------------------------------------------
  const aside = document.querySelector(".cr-aside");
  const panel = el("div", "cr-panel crx-panel");
  if (aside) aside.insertBefore(panel, aside.firstChild);

  // ---- Shoutouts: paid perks arrive from the Stripe webhook (CONCERT_SHOUTOUTS) ----
  const shoutPanel = el("div", "cr-panel crx-shoutlist");
  shoutPanel.hidden = true;
  if (aside) aside.insertBefore(shoutPanel, panel.nextSibling);
  let censor = (t) => t;
  import("./text-censor.js")
    .then((m) => { if (m && typeof m.censorProfanity === "function") { censor = m.censorProfanity; renderShouts(); } })
    .catch(() => {});
  const loadedAt = Date.now();
  let shouts = [];
  let shoutsSeen = null;
  const bannerQueue = [];
  let bannerBusy = false;

  function shoutsSince() {
    const st = status();
    if (st.current) return st.current.startsAt - 30 * 60 * 1000;
    const startedAt = Number(state.roomData && state.roomData.startedAt) || 0;
    return startedAt ? startedAt - 30 * 60 * 1000 : Date.now() - 6 * 60 * 60 * 1000;
  }

  function renderShouts() {
    const since = shoutsSince();
    const list = shouts.filter((x) => x.ts >= since).slice(0, 15);
    shoutPanel.hidden = !list.length;
    if (!list.length) return;
    shoutPanel.innerHTML = "<h3>Shoutouts and requests</h3>" + list.map((x) =>
      '<div class="crx-sh"><b>' + esc(x.name || "A fan") + "</b><span>" + esc(x.perk || "") + "</span>" +
      (x.message ? "<p>" + esc(censor(String(x.message))) + "</p>" : "") + "</div>").join("");
  }

  function nextBanner() {
    const x = bannerQueue.shift();
    if (!x) { bannerBusy = false; return; }
    bannerBusy = true;
    const b = el("div", "crx-shout",
      "<b>" + icon("celebration") + esc(x.name || "A fan") + " · " + esc(x.perk || "Support") + "</b>" +
      "<p>" + (x.message ? esc(censor(String(x.message))) : "Thank you for supporting " + esc(x.artist || "the artist") + "!") + "</p>");
    b.setAttribute("role", "status");
    document.body.appendChild(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("show")));
    setTimeout(() => {
      b.classList.remove("show");
      setTimeout(() => { b.remove(); nextBanner(); }, 500);
    }, 9000);
  }

  onValue(ref(db, "CONCERT_SHOUTOUTS/" + room), (snap) => {
    const v = snap.val() || {};
    shouts = Object.entries(v)
      .map(([id, x]) => ({ id, ...(x || {}) }))
      .filter((x) => typeof x.ts === "number")
      .sort((a, b) => b.ts - a.ts);
    if (shoutsSeen === null) {
      shoutsSeen = new Set(shouts.map((x) => x.id));
    } else {
      for (const x of shouts.slice().reverse()) {
        if (shoutsSeen.has(x.id)) continue;
        shoutsSeen.add(x.id);
        if (x.ts > loadedAt - 2 * 60 * 1000) {
          bannerQueue.push(x);
          if (!bannerBusy) nextBanner();
        }
      }
    }
    renderShouts();
  }, () => {});

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    if (t.dataset.act === "spend") openSpend();
    if (t.dataset.act === "tip") openStripe(state.cfg.tipLink, "tip");
    if (t.dataset.act === "perk") {
      const perk = state.cfg.perks[Number(t.dataset.i)];
      if (perk) openStripe(perk.url, perk.name);
    }
    if (t.dataset.act === "artist-tip") {
      const link = artistTipLink(state.roomData);
      if (link) openExternal(link);
    }
    if (t.dataset.act === "how") {
      const s = readSurvey();
      openSlides((s && s.role) || "fan", (s && s.fanOf) || []);
    }
  });

  function artistOptions() {
    const seen = new Map();
    const add = (name, emailKey) => {
      const n = String(name || "").trim();
      if (!n) return;
      const k = n.toLowerCase();
      if (!seen.has(k)) seen.set(k, { name: n, emailKey: emailKey || "" });
      else if (emailKey && !seen.get(k).emailKey) seen.get(k).emailKey = emailKey;
    };
    const st = status();
    if (st.current) add(st.current.artist);
    if (st.next) add(st.next.artist);
    for (const a of Object.values(state.cfg.artists || {})) if (a) add(a.name, a.emailKey);
    const now = Date.now();
    for (const s of shows()) if (s.endsAt > now) add(s.artist);
    return [...seen.values()];
  }

  function attendanceLine() {
    const st = status();
    const cfg = state.cfg;
    const show = st.current;
    if (!show) {
      if (st.next) return icon("event") + "<span>Next show: " + esc(st.next.artist || "TBA") + ", " + esc(fmtWhen(st.next.startsAt)) + "</span>";
      if (st.streamLive) return icon("info") + "<span>Points for watching apply to scheduled shows.</span>";
      return "";
    }
    if (state.mine.attendance && state.mine.attendance[show.id]) {
      return icon("check_circle") + "<span>+" + cfg.pointsPerShow + " pts earned for this show</span>";
    }
    if (!st.streamLive) return icon("schedule") + "<span>Points for watching start when the stream starts.</span>";
    const secs = Math.min(watchedSecs(show.id), cfg.attendMinutes * 60);
    return icon("visibility") + "<span>Watching: " + Math.floor(secs / 60) + " of " + cfg.attendMinutes +
      " min for +" + cfg.pointsPerShow + " pts</span>";
  }

  function renderPanel() {
    const cfg = state.cfg;
    const fee = cfg.rewardsSharePct + cfg.asteroidSharePct;
    const fine = '<p class="crx-fine">Pay with the email on your Asteroid account to earn ' + cfg.pointsPerDollar +
      " pts per $1. Artists keep " + cfg.artistSharePct + "% after card fees. Asteroid's " + fee + "%: " +
      cfg.rewardsSharePct + "% funds fan rewards, " + cfg.asteroidSharePct + "% runs Asteroid. Direct tips go 100% to the artist.</p>";
    const st = status();
    const tipArtist = st.current && st.current.artist ? st.current.artist : "the artist";
    const artistLink = artistTipLink(state.roomData);
    let tipBtn = "";
    if (st.live && (cfg.tipLink || cfg.perks.length || artistLink)) {
      tipBtn = '<div class="crx-support"><div class="crx-support-title">Support ' + esc(tipArtist) + "</div>" +
        (cfg.tipLink ? '<button class="crx-btn tip" data-act="tip">' + icon("favorite") + "Tip " + esc(tipArtist) + "</button>" : "") +
        (cfg.perks.length ? '<div class="crx-perks">' + cfg.perks.map((pk, i) =>
          '<button class="crx-btn tip" data-act="perk" data-i="' + i + '">' + esc(pk.name) + "<small>$" + pk.price + "</small></button>").join("") + "</div>" : "") +
        (artistLink ? '<button class="crx-btn ghost" data-act="artist-tip">' + icon("favorite") + "Tip " + esc(tipArtist) + " directly</button>" : "") +
        "</div>";
    }
    if (!state.user) {
      panel.innerHTML = '<h3><span>Earn points</span><button class="crx-link" data-act="how">How it works</button></h3>' +
        '<p class="cr-hint">Log in to earn points for watching and tipping. Spend them on gift cards, shoutouts and more.</p>' +
        '<a class="crx-btn" href="login.html">Log in</a>' + tipBtn + fine;
      return;
    }
    const r = rewards();
    const flames = Array.from({ length: cfg.streakDays }, (_, i) => "<i" + (i < r.streakProgress ? ' class="on"' : "") + "></i>").join("");
    const att = attendanceLine();
    panel.innerHTML =
      '<h3><span>Your points</span><button class="crx-link" data-act="how">How it works</button></h3>' +
      '<div class="crx-balance"><b>' + fmtPts(r.balance) + "</b><span>pts</span><em>" + ptsToUsd(Math.max(0, r.balance)) + "</em></div>" +
      (r.pending > 0 ? '<div class="crx-line">' + icon("hourglass_top") + "<span>" + fmtPts(r.pending) + " pts in pending requests</span></div>" : "") +
      '<div class="crx-line">' + icon("local_fire_department") + '<span class="crx-flames">' + flames + "</span><span>Streak " +
      r.streakProgress + " of " + cfg.streakDays + " show days for +" + fmtPts(cfg.streakBonusPoints) + " pts</span></div>" +
      (att ? '<div class="crx-line">' + att + "</div>" : "") +
      '<button class="crx-btn" data-act="spend">' + icon("redeem") + "Spend points</button>" + tipBtn + fine;
  }

  // ---- Support: Stripe Payment Links and the artist's own tip link ---------------
  function browserPlugin() {
    try {
      const C = window.Capacitor;
      const P = C && C.Plugins && C.Plugins.Browser;
      if (P && typeof P.open === "function") return P;
      if (C && typeof C.nativePromise === "function" && typeof C.getPlatform === "function" && C.getPlatform() === "ios") {
        return { open: (opts) => C.nativePromise("Browser", "open", opts || {}) };
      }
    } catch (e) {}
    return null;
  }

  function stripeUrl(base, tag) {
    const st = status();
    const show = st.current;
    const parts = [refSlug(show && show.artist ? show.artist : room), show ? show.id : refSlug(room), refSlug(tag), state.key ? "fan" : "guest"];
    let url;
    try { url = new URL(base); } catch (e) { return ""; }
    url.searchParams.set("client_reference_id", parts.map((x) => String(x).replace(/[^A-Za-z0-9_-]/g, "")).join("__").slice(0, 200));
    if (state.user && state.user.email) url.searchParams.set("prefilled_email", state.user.email);
    return url.toString();
  }

  function openExternal(url) {
    if (!url) return;
    const B = browserPlugin();
    if (B) { B.open({ url, presentationStyle: "fullscreen" }); return; }
    const w = window.open(url, "_blank");
    if (w) { try { w.opener = null; } catch (e) {} } else { location.href = url; }
  }

  function openStripe(base, tag) {
    openExternal(stripeUrl(base, tag));
  }

  // ---- Attendance: watch a scheduled show for N minutes ---------------------------
  function watchKey(showId) { return "astWatch_" + state.key + "_" + showId; }
  function watchedSecs(showId) {
    try { return Number(localStorage.getItem(watchKey(showId))) || 0; } catch (e) { return 0; }
  }
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    const delta = Math.min(now - lastTick, 20000);
    lastTick = now;
    const st = status();
    const show = st.current;
    if (state.key && show && st.streamLive && !document.hidden &&
        !(state.mine.attendance && state.mine.attendance[show.id])) {
      const secs = watchedSecs(show.id) + delta / 1000;
      try { localStorage.setItem(watchKey(show.id), String(Math.round(secs))); } catch (e) {}
      if (secs >= state.cfg.attendMinutes * 60 && !state.writingAttendance && now >= state.attendanceRetryAt) {
        state.writingAttendance = true;
        set(ref(db, "REWARDS/attendance/" + state.key + "/" + show.id), { ts: serverTimestamp(), room })
          .then(() => toast("+" + state.cfg.pointsPerShow + " points for watching"))
          .catch((e) => { console.warn("[rewards] attendance", e && e.code); state.attendanceRetryAt = Date.now() + 60000; })
          .finally(() => { state.writingAttendance = false; });
      }
    }
    renderPill();
    renderPanel();
  }
  setInterval(tick, 15000);

  // ---- Data -------------------------------------------------------------------------
  onValue(ref(db, "CONCERT_CONFIG"), (s) => { state.cfg = readConfig(s.val()); renderPill(); renderPanel(); }, () => {});
  onValue(ref(db, "CONCERT_SCHEDULE"), (s) => { state.schedule = s.val(); renderPill(); renderPanel(); renderShouts(); }, () => {});
  onValue(ref(db, "LiveRooms/" + room), (s) => { state.roomData = s.val(); renderPill(); renderPanel(); renderShouts(); }, () => {});

  let unsubs = [];
  onAuthStateChanged(auth, (user) => {
    unsubs.forEach((u) => u());
    unsubs = [];
    state.mine = { attendance: null, tips: null, adjust: null, redemptions: null };
    state.user = user && user.email ? user : null;
    state.key = state.user ? rewardsKey(state.user.email) : "";
    if (state.key) {
      for (const part of ["attendance", "tips", "adjust", "redemptions"]) {
        unsubs.push(onValue(ref(db, "REWARDS/" + part + "/" + state.key), (s) => {
          state.mine[part] = s.val();
          renderPanel();
          if (spendOpen) renderSpend();
        }, (e) => console.warn("[rewards] read " + part, e && e.code)));
      }
    }
    renderPanel();
  });
  renderPill();
  renderPanel();

  // ---- Modal + toast ----------------------------------------------------------------
  let overlay = null;
  let spendOpen = false;
  function openModal(closable) {
    closeModal();
    overlay = el("div", "crx-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const modal = el("div", "crx-modal");
    overlay.appendChild(modal);
    if (closable) {
      const x = el("button", "crx-close", icon("close"));
      x.setAttribute("aria-label", "Close");
      x.addEventListener("click", closeModal);
      modal.appendChild(x);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    }
    const body = el("div", "crx-modal-body");
    modal.appendChild(body);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    return body;
  }
  function closeModal() {
    spendOpen = false;
    if (overlay) overlay.remove();
    overlay = null;
    document.body.style.overflow = "";
  }

  let toastTimer = null;
  function toast(msg) {
    let t = document.querySelector(".crx-toast");
    if (!t) { t = el("div", "crx-toast"); document.body.appendChild(t); }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  // ---- Survey + intro slides -------------------------------------------------------
  function openSurvey() {
    const body = openModal(false);
    body.innerHTML =
      '<p class="crx-kicker">Welcome to Asteroid Live</p><h2>Are you a fan or an artist?</h2>' +
      '<p class="crx-sub">Two quick questions, then you\'re in.</p><div class="crx-choice">' +
      '<button type="button" data-role="fan">' + icon("favorite") + "I'm a fan</button>" +
      '<button type="button" data-role="artist">' + icon("mic") + "I'm an artist</button></div>";
    body.querySelectorAll("[data-role]").forEach((b) =>
      b.addEventListener("click", () => askFanOf(body, b.dataset.role)));
  }

  function askFanOf(body, role) {
    const picked = new Set();
    const draw = () => {
      const opts = artistOptions();
      body.innerHTML =
        '<p class="crx-kicker">' + (role === "artist" ? "Artist" : "Fan") + "</p><h2>Who are you a fan of?</h2>" +
        '<p class="crx-sub">' + (opts.length ? "Pick as many as you like." : "Type the artists you love.") + "</p>" +
        '<div class="crx-chips">' + opts.map((a) =>
          '<button type="button" class="crx-chip' + (picked.has(a.name) ? " on" : "") + '" data-name="' + esc(a.name) + '">' + esc(a.name) + "</button>").join("") +
        "</div>" +
        '<input class="crx-input" id="crxOther" maxlength="120" placeholder="' + (opts.length ? "Someone else? Type their name" : "Artist names") + '">' +
        '<button type="button" class="crx-btn" id="crxNext">Next</button>';
      body.querySelectorAll(".crx-chip").forEach((c) => c.addEventListener("click", () => {
        const n = c.dataset.name;
        if (picked.has(n)) picked.delete(n); else picked.add(n);
        c.classList.toggle("on", picked.has(n));
      }));
      body.querySelector("#crxNext").addEventListener("click", async () => {
        const other = body.querySelector("#crxOther").value.trim().slice(0, 120);
        const fanOf = [...picked].slice(0, 30);
        await saveSurvey(role, fanOf, other);
        openSlides(role, fanOf);
      });
    };
    draw();
  }

  async function saveSurvey(role, fanOf, other) {
    try { if (auth.authStateReady) await auth.authStateReady(); } catch (e) {}
    const u = auth.currentUser;
    const key = u && u.email ? rewardsKey(u.email) : anonId();
    const data = { role, fanOf, other, room, ts: Date.now() };
    if (u && u.email) data.email = u.email;
    else if (appEmailKey()) data.emailKey = appEmailKey();
    try { localStorage.setItem(SURVEY_KEY, JSON.stringify({ role, fanOf, ts: data.ts })); } catch (e) {}
    try { await set(ref(db, "FAN_SURVEY/" + key), data); } catch (e) { console.warn("[rewards] survey", e && e.code); }
  }

  function slidesFor(role) {
    const c = state.cfg;
    const fee = c.rewardsSharePct + c.asteroidSharePct;
    const ig = "@" + String(c.instagram || "").replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
    if (role === "artist") {
      return [
        { logo: true, t: "Welcome to Asteroid", p: ["Upload music, go live, get heard. A music platform built for artists and the fans who back them."],
          list: ["No pay to play", "No algorithm deciding who hears you", "Fans support you directly"] },
        { i: "campaign", t: "Get spotlighted", p: ["Play a show here and Asteroid promotes you."],
          list: ["Spotlight on " + ig, "Your song in Featured Songs on Asteroid", "Promo posts before your show"] },
        { i: "mic", t: "Go live, get paid", p: ["Fans tip you during your show. You keep " + c.artistSharePct + "% of every tip after card fees."] },
        { i: "group_add", t: "Fans come back for you", p: [
          "Every tip and every show earns your fans points, so they keep coming back.",
          "Ask them to follow you here so they hear about your next show."] },
      ];
    }
    return [
      { logo: true, t: "Welcome to Asteroid", p: ["Music built around fans and artists, not ads. We spotlight new artists, feature their songs and bring them here live."],
        list: ["No ads interrupting the music", "No algorithm deciding what you hear", "Your support goes to the artist"] },
      { i: "volunteer_activism", t: "Your tips go to the artist", p: [
        "Artists keep " + c.artistSharePct + "% of every tip after card fees.",
        "Asteroid's " + fee + "% fee splits in two: " + c.rewardsSharePct + "% pays for fan rewards, " + c.asteroidSharePct + "% keeps Asteroid running."] },
      { i: "stars", t: "Earn points", p: [
        c.pointsPerDollar + " points for every $1 you tip. " + c.pointsPerShow + " points for every show you watch. " + POINTS_PER_USD + " points = $1.",
        "Spend them on gift cards, tips, shoutouts, badges or early access."],
        small: "Gift cards: " + GIFT_CARDS.join(", ") + "." },
      { i: "local_fire_department", t: "Keep your streak", p: [
        "Watch on " + c.streakDays + " show days in a row and get " + fmtPts(c.streakBonusPoints) + " bonus points. That's a free " + ptsToUsdShort(c.streakBonusPoints) + " gift card.",
        "Follow your artists so you never miss a show."] },
    ];
  }

  function openSlides(role, fanOf) {
    const body = openModal(true);
    const slides = slidesFor(role);
    let i = 0;
    const draw = () => {
      const s = slides[i];
      const last = i === slides.length - 1;
      let follow = "";
      if (last) {
        const byName = new Map(artistOptions().map((a) => [a.name.toLowerCase(), a]));
        const followable = (fanOf || []).map((n) => byName.get(String(n).toLowerCase())).filter((a) => a && a.emailKey);
        follow = '<div class="crx-follow">' +
          followable.map((a) => '<button type="button" class="crx-btn ghost" data-follow="' + esc(a.emailKey) + '">' + icon("person_add") + "Follow " + esc(a.name) + "</button>").join("") +
          '<a class="crx-btn ghost" href="' + esc(state.cfg.instagram) + '" target="_blank" rel="noopener">' + icon("photo_camera") + "Follow Asteroid on Instagram</a></div>";
      }
      body.innerHTML =
        '<div class="crx-slide">' +
        (s.logo ? '<img class="crx-logo" src="astei.jpg" alt="Asteroid">' : icon(s.i).replace("material-symbols-outlined", "material-symbols-outlined crx-slide-icon")) +
        "<h2>" + esc(s.t) + "</h2>" + s.p.map((x) => "<p>" + esc(x) + "</p>").join("") +
        (s.list ? '<ul class="crx-checks">' + s.list.map((x) => "<li>" + icon("check_circle") + esc(x) + "</li>").join("") + "</ul>" : "") +
        (s.small ? '<p class="small">' + esc(s.small) + "</p>" : "") + "</div>" + follow +
        '<div class="crx-dots">' + slides.map((_, k) => "<i" + (k === i ? ' class="on"' : "") + "></i>").join("") + "</div>" +
        '<div class="crx-row">' + (last ? "" : '<button type="button" class="crx-link" data-skip>Skip</button>') +
        '<button type="button" class="crx-btn" data-next>' + (last ? "Enter the concert" : "Next") + "</button></div>";
      body.querySelector("[data-next]").addEventListener("click", () => { if (last) closeModal(); else { i += 1; draw(); } });
      const skip = body.querySelector("[data-skip]");
      if (skip) skip.addEventListener("click", () => { i = slides.length - 1; draw(); });
      body.querySelectorAll("[data-follow]").forEach((b) => b.addEventListener("click", () => followArtist(b)));
    };
    draw();
  }

  async function followArtist(btn) {
    const artistKey = btn.dataset.follow;
    const me = appEmailKey();
    if (!me) { toast("Log in to follow artists"); return; }
    if (me === artistKey) return;
    btn.disabled = true;
    try {
      try {
        await update(ref(db), { ["FOLLOWS/" + artistKey + "/" + me]: true, ["FOLLOWING/" + me + "/" + artistKey]: true });
      } catch (e) {
        await set(ref(db, "FOLLOWS/" + artistKey + "/" + me), true);
        await set(ref(db, "FOLLOWING/" + me + "/" + artistKey), true);
      }
      btn.className = "crx-btn done";
      btn.innerHTML = icon("check") + "Following";
    } catch (e) {
      btn.disabled = false;
      toast("Couldn't follow right now. Try again.");
    }
  }

  // ---- Spend points -----------------------------------------------------------------
  let spendTab = "giftcard";
  let spendBody = null;
  const spendForm = { card: "", amount: 0, artist: "", tipPts: 0, message: "" };

  function openSpend() {
    if (!state.user) { location.href = "login.html"; return; }
    spendBody = openModal(true);
    spendOpen = true;
    renderSpend();
  }

  function renderSpend() {
    if (!spendBody || !spendOpen) return;
    const cfg = state.cfg;
    const r = rewards();
    const bal = Math.max(0, r.balance);
    const tabs = [["giftcard", "Gift card"], ["tip", "Tip artist"], ["shoutout", "Shoutout"], ["badge", "Badge"], ["early", "Early access"]];
    let form = "";
    if (spendTab === "giftcard") {
      const maxUsd = Math.min(100, Math.floor(bal / POINTS_PER_USD / 5) * 5);
      const amounts = [];
      for (let v = cfg.minGiftCardUsd; v <= maxUsd; v += 5) amounts.push(v);
      if (!amounts.includes(spendForm.amount)) spendForm.amount = amounts[0] || 0;
      form = '<div class="crx-chips">' + GIFT_CARDS.map((g) =>
        '<button type="button" class="crx-chip' + (spendForm.card === g ? " on" : "") + '" data-card="' + esc(g) + '">' + esc(g) + "</button>").join("") + "</div>";
      if (!amounts.length) {
        const need = cfg.minGiftCardUsd * POINTS_PER_USD - bal;
        form += '<p class="crx-sub">You need ' + fmtPts(need) + " more points for a $" + cfg.minGiftCardUsd + " card.</p>";
      } else {
        form += '<label class="crx-label" for="crxAmt">Amount</label><select class="crx-input" id="crxAmt">' +
          amounts.map((v) => '<option value="' + v + '"' + (v === spendForm.amount ? " selected" : "") + ">$" + v + " (" + fmtPts(v * POINTS_PER_USD) + " pts)</option>").join("") +
          "</select>" +
          '<label class="crx-label" for="crxEmail">Send the code to</label><input class="crx-input" id="crxEmail" type="email" value="' + esc(state.user.email) + '">' +
          '<button type="button" class="crx-btn" data-submit ' + (spendForm.card ? "" : "disabled") + ">" +
          (spendForm.card ? "Get a $" + spendForm.amount + " " + esc(spendForm.card) + " card" : "Pick a card") + "</button>" +
          '<p class="crx-fine">We email your code within 48 hours.</p>';
      }
    } else if (spendTab === "tip") {
      const opts = artistOptions();
      if (!spendForm.artist && opts[0]) spendForm.artist = opts[0].name;
      if (!spendForm.tipPts) spendForm.tipPts = cfg.costs.minTip;
      form = '<label class="crx-label" for="crxArtist">Artist</label>' +
        (opts.length
          ? '<select class="crx-input" id="crxArtist">' + opts.map((a) => '<option' + (a.name === spendForm.artist ? " selected" : "") + ">" + esc(a.name) + "</option>").join("") + "</select>"
          : '<input class="crx-input" id="crxArtist" maxlength="80" placeholder="Artist name" value="' + esc(spendForm.artist) + '">') +
        '<label class="crx-label" for="crxTipPts">Points</label><input class="crx-input" id="crxTipPts" type="number" inputmode="numeric" min="' + cfg.costs.minTip + '" step="50" value="' + spendForm.tipPts + '">' +
        '<button type="button" class="crx-btn" data-submit>Send ' + fmtPts(spendForm.tipPts) + " pts (" + ptsToUsd(spendForm.tipPts) + ") to the artist</button>" +
        '<p class="crx-fine">Asteroid pays the artist the full dollar value from the fan rewards pool.</p>';
    } else if (spendTab === "shoutout") {
      form = '<p class="crx-sub">Send a message for the artist to read out during a show.</p>' +
        '<input class="crx-input" id="crxMsg" maxlength="140" placeholder="Your shoutout" value="' + esc(spendForm.message) + '">' +
        '<button type="button" class="crx-btn" data-submit>Request shoutout · ' + fmtPts(cfg.costs.shoutout) + " pts</button>";
    } else if (spendTab === "badge") {
      form = '<p class="crx-sub">A supporter badge on your Asteroid profile.</p>' +
        '<button type="button" class="crx-btn" data-submit>Get the badge · ' + fmtPts(cfg.costs.badge) + " pts</button>";
    } else {
      form = '<p class="crx-sub">Get the link to the next show before everyone else.</p>' +
        '<button type="button" class="crx-btn" data-submit>Get early access · ' + fmtPts(cfg.costs.early) + " pts</button>";
    }

    const reqs = Object.entries(state.mine.redemptions || {}).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const list = reqs.length
      ? "<h3 style=\"margin:20px 0 4px;font-size:14px;color:#fff\">Your requests</h3>" + reqs.slice(0, 20).map((q) =>
        '<div class="crx-req"><div>' + esc(REDEEM_LABELS[q.type] || q.type) + (q.card ? ": " + esc(q.card) : "") +
        "<small>" + esc(q.detail || "") + (q.detail ? " · " : "") + fmtPts(q.points) + " pts · " + new Date(q.ts || 0).toLocaleDateString("en-US") + "</small></div>" +
        '<span class="crx-status ' + esc(q.status) + '">' + esc(q.status) + "</span></div>").join("")
      : "";

    spendBody.innerHTML =
      "<h2>Spend points</h2><p class=\"crx-sub\">Balance: <b style=\"color:#fff\">" + fmtPts(bal) + " pts</b> (" + ptsToUsd(bal) + ")</p>" +
      '<div class="crx-tabs">' + tabs.map(([k, label]) => '<button type="button" data-tab="' + k + '"' + (k === spendTab ? ' class="on"' : "") + ">" + label + "</button>").join("") + "</div>" +
      form + list;

    spendBody.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { spendTab = b.dataset.tab; renderSpend(); }));
    spendBody.querySelectorAll("[data-card]").forEach((b) => b.addEventListener("click", () => { spendForm.card = b.dataset.card; renderSpend(); }));
    const amt = spendBody.querySelector("#crxAmt");
    if (amt) amt.addEventListener("change", () => { spendForm.amount = Number(amt.value); renderSpend(); });
    const art = spendBody.querySelector("#crxArtist");
    if (art) art.addEventListener("change", () => { spendForm.artist = art.value.trim(); });
    const tp = spendBody.querySelector("#crxTipPts");
    if (tp) tp.addEventListener("change", () => { spendForm.tipPts = Math.max(cfg.costs.minTip, Math.floor(Number(tp.value) || 0)); renderSpend(); });
    const msg = spendBody.querySelector("#crxMsg");
    if (msg) msg.addEventListener("input", () => { spendForm.message = msg.value; });
    const submit = spendBody.querySelector("[data-submit]");
    if (submit) submit.addEventListener("click", () => submitSpend(submit));
  }

  async function submitSpend(btn) {
    const cfg = state.cfg;
    const bal = rewards().balance;
    const req = { type: spendTab, ts: Date.now(), status: "pending", email: state.user.email };
    let done = "Request sent.";
    if (spendTab === "giftcard") {
      const email = (spendBody.querySelector("#crxEmail") || {}).value || state.user.email;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast("Enter a valid email"); return; }
      req.email = email.trim().slice(0, 200);
      req.card = spendForm.card;
      req.points = spendForm.amount * POINTS_PER_USD;
      req.detail = "$" + spendForm.amount;
      done = "Request sent. Your " + spendForm.card + " code arrives by email within 48 hours.";
    } else if (spendTab === "tip") {
      const artInput = spendBody.querySelector("#crxArtist");
      const artist = ((artInput && artInput.value) || spendForm.artist || "").trim().slice(0, 80);
      if (!artist) { toast("Pick an artist"); return; }
      req.points = Math.max(cfg.costs.minTip, Math.floor(spendForm.tipPts));
      req.detail = artist;
      done = "Sent. " + artist + " gets " + ptsToUsd(req.points) + " from your points.";
    } else if (spendTab === "shoutout") {
      const m = (spendForm.message || "").trim().slice(0, 140);
      if (!m) { toast("Write your shoutout first"); return; }
      req.points = cfg.costs.shoutout;
      req.detail = m;
    } else if (spendTab === "badge") {
      req.points = cfg.costs.badge;
    } else {
      req.points = cfg.costs.early;
    }
    if (!(req.points > 0) || req.points > bal) { toast("Not enough points yet"); return; }
    btn.disabled = true;
    try {
      await push(ref(db, "REWARDS/redemptions/" + state.key), req);
      spendForm.message = "";
      toast(done);
    } catch (e) {
      console.warn("[rewards] redeem", e && e.code);
      toast("Couldn't send that. Try again.");
      btn.disabled = false;
    }
  }

  // First visit on this device: survey, then the intro slides.
  if (!readSurvey()) openSurvey();
}
