// Free concert pass (pass.html). Every artist shares www.asteroid8.net/pass?a=theirname.
//   Fans pick the nights, sign in once and get a pass: CONCERT_PASSES/{showId}/{uk}
//   (via = the artist whose link brought them, so admin can see who brings fans).
//   Passes come with calendar buttons, and the concertPassEmails function emails a
//   confirmation and a reminder an hour before each night.
//   Artists who follow these artists can apply to play a future show: ARTIST_APPLICATIONS/{uk}.

import { ref, onValue, get, set, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import {
  initializeAuth, getAuth, onAuthStateChanged, browserLocalPersistence, indexedDBLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  firebaseApp, firebaseDb, readConfig, rewardsKey, esc, fmtPts, listShows, captureInvite, isInviteCode, newInviteCode,
  artistKey, passUrl, showsWithArtist, artistNameFor, isHalloween, fmtUsTimes, fmtShowLocal, googleCalUrl, icsText, watchUrl, cleanHandle,
} from "./concert-rewards-core.js";

const VIA_KEY = "astPassVia";
const PENDING_KEY = "astPassPending";
const VIA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 2 * 60 * 60 * 1000;
const LOGIN = "login.html?return=pass.html";

const $ = (s) => document.getElementById(s);
const icon = (n) => '<span class="material-symbols-outlined" aria-hidden="true">' + n + "</span>";

function readJson(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
function writeJson(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/** The artist whose link brought this fan: ?a= in the URL, else the one saved from an earlier visit. */
function captureVia() {
  let a = "";
  try {
    const u = new URL(location.href);
    a = artistKey(u.searchParams.get("a"));
  } catch (e) {}
  if (a) { writeJson(VIA_KEY, { a, ts: Date.now() }); return a; }
  const saved = readJson(VIA_KEY);
  return saved && artistKey(saved.a) === saved.a && Date.now() - Number(saved.ts || 0) < VIA_TTL_MS ? saved.a : "";
}

function viewerTz() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return /^[A-Za-z0-9_+/-]{1,64}$/.test(tz) ? tz : "";
  } catch (e) { return ""; }
}

function initAuth(app) {
  try { return initializeAuth(app, { persistence: [browserLocalPersistence, indexedDBLocalPersistence] }); }
  catch (e) { return getAuth(app); }
}

let toastTimer = 0;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.setAttribute("aria-busy", "true"); if (label) btn.textContent = label; }
  else { btn.removeAttribute("aria-busy"); if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

const app = firebaseApp();
const db = firebaseDb();
const auth = initAuth(app);
captureInvite(); // a friend's ?invite= code, credited when this fan watches a show

const state = {
  a: captureVia(),
  cfg: readConfig(null),
  shows: [],
  scheduleLoaded: false,
  user: null,
  key: "",
  mine: {},          // showId -> pass record
  mineSubs: new Map(),
  application: null,
  appLoaded: false,
  picks: new Set(),
  picksTouched: false,
  pendingDone: false,
  myInvite: "",
};

function upcoming() {
  const now = Date.now();
  return state.shows.filter((s) => s.endsAt > now);
}
function artistName() { return artistNameFor(state.a, state.shows, state.cfg); }
function claimedIds() { return Object.keys(state.mine).filter((id) => state.mine[id]); }

function defaultPicks() {
  const list = upcoming().filter((s) => !state.mine[s.id]);
  const theirs = showsWithArtist(list, state.a);
  return new Set((theirs.length ? theirs : list).map((s) => s.id));
}

function lineupHtml(show) {
  const k = state.a;
  const names = show.artists.length ? show.artists : [show.artist || "Asteroid artists"];
  const parts = names.map((n) => (k && artistKey(n) === k ? "<strong>" + esc(n) + "</strong>" : esc(n)));
  return parts.length <= 1 ? parts.join("") : parts.slice(0, -1).join(", ") + " &amp; " + parts[parts.length - 1];
}

function tagsHtml(show, now) {
  let t = "";
  if (show.startsAt <= now && now <= show.endsAt) t += '<span class="tag live">Live now</span>';
  if (isHalloween(show.startsAt)) t += '<span class="tag boo">Halloween show</span>';
  return t;
}

// ---- Render ----------------------------------------------------------------------------
function renderHero() {
  const name = artistName();
  if (name) {
    $("title").innerHTML = esc(name) + " live on <em>Asteroid</em>";
    document.title = name + " live on Asteroid: free pass";
  }
  $("who").textContent = state.user ? state.user.email : "";
}

function renderNights() {
  const now = Date.now();
  const list = upcoming();
  const box = $("nights");
  const btn = $("claimBtn");
  if (!state.scheduleLoaded) return;
  if (!list.length) {
    box.innerHTML = '<p class="hint">New dates are coming soon. Check back here, or apply below to play one.</p>';
    btn.hidden = true;
    $("claimFine").hidden = true;
    $("nightsHint").hidden = true;
    return;
  }
  // First visit: the artist's nights are ticked. Once a fan has a pass, they tick extra nights themselves.
  if (!state.picksTouched) state.picks = claimedIds().length ? new Set() : defaultPicks();
  const open = list.filter((s) => !state.mine[s.id]);
  $("nightsTitle").textContent = open.length === list.length ? "Pick your nights" : open.length ? "Add more nights" : "Every night is on your pass";
  $("nightsHint").hidden = !open.length;
  box.innerHTML = list.map((s) => {
    const mine = !!state.mine[s.id];
    const on = !mine && state.picks.has(s.id);
    const body = "<div><b>" + esc(fmtShowLocal(s.startsAt)) + "</b><small>" + esc(fmtUsTimes(s.startsAt)) + '</small><small class="lineup">' +
      lineupHtml(s) + "</small>" + tagsHtml(s, now) + "</div>";
    if (mine) return '<div class="night in">' + icon("check_circle").replace("material-symbols-outlined", "material-symbols-outlined ok") + body + "</div>";
    return '<label class="night' + (on ? " on" : "") + '"><input type="checkbox" data-pick="' + esc(s.id) + '"' + (on ? " checked" : "") + ">" + body + "</label>";
  }).join("");
  btn.hidden = !open.length;
  $("claimFine").hidden = !open.length || !!state.user;
  renderClaimBtn();
}

function renderClaimBtn() {
  const open = upcoming().filter((s) => !state.mine[s.id]);
  const n = [...state.picks].filter((id) => open.some((s) => s.id === id)).length;
  $("claimBtn").innerHTML = icon("confirmation_number") + (!n ? "Pick a night above"
    : (state.user && claimedIds().length ? "Add " : "Get my free pass for ") + (n === 1 ? "1 night" : n + " nights"));
}

function renderMine() {
  const card = $("mineCard");
  const now = Date.now();
  const mine = upcoming().filter((s) => state.mine[s.id]);
  if (!state.user || !mine.length) { card.hidden = true; card.innerHTML = ""; return; }
  const cfg = state.cfg;
  const a = cfg.referralPoints, b = cfg.referralFriendPoints;
  const invite = a > 0 && a === b ? "Bring a friend. You both get +" + fmtPts(a) + " pts when they watch a show."
    : "Bring a friend to the show.";
  card.hidden = false;
  card.innerHTML = "<h2>" + icon("check_circle") + "You're in</h2>" +
    '<p class="hint">Watch for ' + cfg.attendMinutes + " minutes of a show to earn +" + fmtPts(cfg.pointsPerShow) + " pts. Add your nights to your calendar so you don't miss them.</p>" +
    mine.map((s) => {
      const live = s.startsAt <= now && now <= s.endsAt;
      return '<div class="mine"><b>' + esc(fmtShowLocal(s.startsAt)) + "</b><small>" + lineupHtml(s) + " · " + esc(fmtUsTimes(s.startsAt)) + "</small>" +
        '<div class="actions">' +
        (live ? '<a class="btn small" href="' + esc(watchUrl(s)) + '">' + icon("play_circle") + "Watch now</a>" : "") +
        '<a class="btn small ghost" href="' + esc(googleCalUrl(s)) + '" target="_blank" rel="noopener">' + icon("event") + "Google Calendar</a>" +
        '<button type="button" class="btn small ghost" data-ics="' + esc(s.id) + '">' + icon("calendar_add_on") + "Apple or Outlook</button>" +
        '<button type="button" class="link" data-cancel="' + esc(s.id) + '">Can\'t make it</button></div></div>';
    }).join("") +
    '<div class="mine"><b>' + esc(invite) + "</b><small>Send your pass link and catch the show together.</small>" +
    '<button type="button" class="btn ghost" data-act="invite">' + icon("ios_share") + "Share your pass link</button></div>";
}

function renderApplication() {
  const box = $("applyStatus");
  const r = state.application;
  if (r && r.name) {
    box.innerHTML = '<p class="hint">' + icon("task_alt") + " You applied as <b>" + esc(r.name) + "</b>. You're on the list for upcoming shows.</p>";
    $("applyOpen").textContent = "Update my application";
  } else {
    box.innerHTML = "";
  }
}

function render() {
  renderHero();
  renderNights();
  renderMine();
  renderApplication();
}

// ---- Passes ----------------------------------------------------------------------------
function firstName() {
  let n = (state.user && state.user.displayName) || "";
  try { n = n || localStorage.getItem("fullName") || ""; } catch (e) {}
  n = String(n).trim().split(/\s+/)[0] || "";
  return n.includes("@") ? "" : n.slice(0, 60);
}

async function claim(ids) {
  const live = new Set(upcoming().map((s) => s.id));
  const want = ids.filter((id) => live.has(id));
  if (!want.length) return 0;
  const fresh = [];
  for (const id of want) {
    const s = await get(ref(db, "CONCERT_PASSES/" + id + "/" + state.key));
    if (!s.exists()) fresh.push(id);
  }
  if (!fresh.length) return 0;
  const rec = { ts: serverTimestamp(), email: state.user.email };
  if (state.a) rec.via = state.a;
  const name = firstName();
  if (name) rec.name = name;
  const tz = viewerTz();
  if (tz) rec.tz = tz;
  const upd = {};
  for (const id of fresh) upd["CONCERT_PASSES/" + id + "/" + state.key] = rec;
  await update(ref(db), upd);
  return fresh.length;
}

async function onClaim() {
  const btn = $("claimBtn");
  $("claimErr").textContent = "";
  const open = upcoming().filter((s) => !state.mine[s.id]).map((s) => s.id);
  const ids = [...state.picks].filter((id) => open.includes(id));
  if (!ids.length) { $("claimErr").textContent = "Pick at least one night."; return; }
  if (!state.user) {
    writeJson(PENDING_KEY, { action: "pass", ids, a: state.a, ts: Date.now() });
    location.href = LOGIN;
    return;
  }
  busy(btn, true, "Getting your pass…");
  try {
    const n = await claim(ids);
    state.picksTouched = false;
    toast(n ? "You're in. See you there!" : "Those nights are already on your pass.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    console.warn("[pass] claim", e && e.code);
    $("claimErr").textContent = "Couldn't get your pass. Try again.";
  } finally {
    busy(btn, false);
    render();
  }
}

async function onCancel(id) {
  const s = state.shows.find((x) => x.id === id);
  if (!confirm("Remove " + (s ? fmtShowLocal(s.startsAt) : "this night") + " from your pass?")) return;
  try { await remove(ref(db, "CONCERT_PASSES/" + id + "/" + state.key)); toast("Removed. You won't get a reminder for it."); }
  catch (e) { toast("Couldn't remove it. Try again."); }
}

function downloadIcs(id) {
  const s = state.shows.find((x) => x.id === id);
  if (!s) return;
  const blob = new Blob([icsText([s])], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "asteroid-concert.ics";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** This fan's invite code (the same one the concert rooms use), made the first time they share. */
async function ensureInviteCode() {
  if (state.myInvite) return state.myInvite;
  try {
    const s = await get(ref(db, "CONCERT_REF_BY_USER/" + state.key));
    if (isInviteCode(s.val())) { state.myInvite = s.val(); return state.myInvite; }
  } catch (e) {}
  for (let i = 0; i < 3; i++) {
    const code = newInviteCode();
    try {
      await update(ref(db), {
        ["CONCERT_REF_CODES/" + code]: { uk: state.key, ts: serverTimestamp() },
        ["CONCERT_REF_BY_USER/" + state.key]: code,
      });
      state.myInvite = code;
      return code;
    } catch (e) { console.warn("[pass] invite code", e && e.code); }
  }
  return "";
}

async function shareInvite(btn) {
  busy(btn, true);
  const code = await ensureInviteCode();
  busy(btn, false);
  const url = passUrl(state.a, code);
  const name = artistName();
  const text = name ? "Catch " + name + " live on Asteroid. Free pass:" : "Free live concerts on Asteroid. Grab a pass:";
  try {
    if (navigator.share) { await navigator.share({ title: "Asteroid live concert", text, url }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast("Link copied. Send it to your friends."); }
  catch (e) { prompt("Copy your pass link:", url); }
}

// ---- Artist applications --------------------------------------------------------------
function readForm() {
  const v = (id) => ($(id).value || "").trim();
  const name = v("ap_name").replace(/\s+/g, " ").slice(0, 80);
  const ig = cleanHandle(v("ap_ig"));
  const genre = v("ap_genre").replace(/\s+/g, " ").slice(0, 60);
  const perform = ["live", "dj", "both"].includes(v("ap_perform")) ? v("ap_perform") : "live";
  const link = v("ap_link");
  const note = v("ap_note").slice(0, 300);
  if (!name) return { error: "Add your artist name." };
  if (!ig) return { error: "Add your Instagram handle, like @yourname." };
  if (!genre) return { error: "Add your genre." };
  if (link && !/^https:\/\/\S{3,290}$/.test(link)) return { error: "Music link should start with https://" };
  return { form: { name, ig, genre, perform, link, note } };
}

function fillForm(f) {
  if (!f) return;
  $("ap_name").value = f.name || "";
  $("ap_ig").value = f.ig ? "@" + f.ig : "";
  $("ap_genre").value = f.genre || "";
  $("ap_perform").value = f.perform || "live";
  $("ap_link").value = f.link || "";
  $("ap_note").value = f.note || "";
}

async function saveApplication(f) {
  const rec = { ts: serverTimestamp(), email: state.user.email, name: f.name, ig: f.ig, genre: f.genre, perform: f.perform };
  if (f.link) rec.link = f.link;
  if (f.note) rec.note = f.note;
  if (state.a) rec.via = state.a;
  await set(ref(db, "ARTIST_APPLICATIONS/" + state.key), rec);
}

async function onApply(ev) {
  ev.preventDefault();
  $("applyErr").textContent = "";
  const r = readForm();
  if (r.error) { $("applyErr").textContent = r.error; return; }
  if (!state.user) {
    writeJson(PENDING_KEY, { action: "apply", form: r.form, a: state.a, ts: Date.now() });
    location.href = LOGIN;
    return;
  }
  const btn = $("applyBtn");
  busy(btn, true, "Sending…");
  try {
    await saveApplication(r.form);
    $("applyForm").hidden = true;
    $("applyOpen").hidden = false;
    toast("Thanks " + r.form.name + "! You're on the list.");
  } catch (e) {
    console.warn("[pass] apply", e && e.code);
    $("applyErr").textContent = "Couldn't send it. Check your details and try again.";
  } finally {
    busy(btn, false);
  }
}

// ---- After signing in: finish what the fan started ------------------------------------
async function runPending() {
  if (state.pendingDone || !state.user || !state.scheduleLoaded) return;
  state.pendingDone = true;
  const p = readJson(PENDING_KEY);
  writeJson(PENDING_KEY, null);
  if (!p || Date.now() - Number(p.ts || 0) > PENDING_TTL_MS) return;
  if (!state.a && artistKey(p.a)) state.a = artistKey(p.a);
  try {
    if (p.action === "pass" && Array.isArray(p.ids)) {
      const n = await claim(p.ids.map(String));
      if (n) toast("You're in. See you there!");
    } else if (p.action === "apply" && p.form) {
      await saveApplication(p.form);
      toast("Thanks " + p.form.name + "! You're on the list.");
    }
  } catch (e) {
    console.warn("[pass] pending", e && e.code);
    if (p.action === "apply") { fillForm(p.form); $("applyForm").hidden = false; $("applyOpen").hidden = true; $("applyErr").textContent = "Couldn't send it. Try again."; }
    else $("claimErr").textContent = "Couldn't get your pass. Try again.";
  }
  render();
}

// ---- Data ------------------------------------------------------------------------------
function watchMine() {
  const ids = new Set(state.key ? upcoming().map((s) => s.id) : []);
  for (const [id, off] of state.mineSubs) if (!ids.has(id)) { off(); state.mineSubs.delete(id); delete state.mine[id]; }
  for (const id of ids) {
    if (state.mineSubs.has(id)) continue;
    state.mineSubs.set(id, onValue(ref(db, "CONCERT_PASSES/" + id + "/" + state.key), (s) => {
      state.mine[id] = s.val();
      render();
    }, (e) => console.warn("[pass] read pass", e && e.code)));
  }
}

onValue(ref(db, "CONCERT_CONFIG"), (s) => { state.cfg = readConfig(s.val()); render(); }, () => {});
onValue(ref(db, "CONCERT_SCHEDULE"), (s) => {
  state.shows = listShows(s.val());
  state.scheduleLoaded = true;
  watchMine();
  render();
  runPending();
}, (e) => { console.warn("[pass] schedule", e && e.code); $("nights").innerHTML = '<p class="hint">Couldn\'t load the lineup. Refresh to try again.</p>'; });

let offApp = null;
onAuthStateChanged(auth, (user) => {
  state.user = user && user.email ? user : null;
  state.key = state.user ? rewardsKey(state.user.email) : "";
  state.myInvite = "";
  for (const off of state.mineSubs.values()) off();
  state.mineSubs.clear();
  state.mine = {};
  if (offApp) { offApp(); offApp = null; }
  state.application = null;
  if (state.key) {
    watchMine();
    offApp = onValue(ref(db, "ARTIST_APPLICATIONS/" + state.key), (s) => { state.application = s.val(); renderApplication(); },
      (e) => console.warn("[pass] read application", e && e.code));
  }
  render();
  runPending();
});

// ---- Events ----------------------------------------------------------------------------
$("nights").addEventListener("change", (e) => {
  const id = e.target && e.target.dataset && e.target.dataset.pick;
  if (!id) return;
  state.picksTouched = true;
  if (e.target.checked) state.picks.add(id); else state.picks.delete(id);
  const row = e.target.closest(".night");
  if (row) row.classList.toggle("on", e.target.checked);
  $("claimErr").textContent = "";
  renderClaimBtn();
});
$("claimBtn").addEventListener("click", onClaim);
$("mineCard").addEventListener("click", (e) => {
  const t = e.target.closest("[data-cancel],[data-ics],[data-act]");
  if (!t) return;
  if (t.dataset.cancel) onCancel(t.dataset.cancel);
  else if (t.dataset.ics) downloadIcs(t.dataset.ics);
  else if (t.dataset.act === "invite") shareInvite(t);
});
$("applyOpen").addEventListener("click", () => {
  fillForm(state.application);
  $("applyForm").hidden = false;
  $("applyOpen").hidden = true;
  $("ap_name").focus();
});
$("applyForm").addEventListener("submit", onApply);
setInterval(render, 60 * 1000);
render();
