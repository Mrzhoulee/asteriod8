// Concerts lobby (lively.html): LIVE badges and "next show" times on the room cards.
// A room shows LIVE while a host stream is embedded (LiveRooms/RoomN) or while a
// show set in admin-rewards.html (CONCERT_SCHEDULE) is inside its time window.

import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { firebaseDb, listShows, roomStatus, fmtWhen, esc, ROOMS } from "./concert-rewards-core.js";

const CSS = `
.lvx-pill{margin-left:auto;flex-shrink:0;font-size:11px;font-weight:700;letter-spacing:.08em;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:rgba(244,244,248,.75);white-space:nowrap}
.lvx-pill.live{background:#ff3b3b;border-color:#ff3b3b;color:#fff;display:inline-flex;align-items:center;gap:6px}
.lvx-pill.live::before{content:"";width:7px;height:7px;border-radius:50%;background:#fff;animation:lvxPulse 1.4s ease-in-out infinite}
@keyframes lvxPulse{0%,100%{opacity:1}50%{opacity:.3}}
.lv-room.lvx-is-live{border-color:rgba(255,59,59,.55);background:rgba(255,59,59,.1)}
.lvx-banner{display:flex;align-items:center;gap:12px;padding:14px 16px;margin:0 0 20px;border-radius:14px;text-decoration:none;color:#f4f4f8;background:rgba(255,255,255,.05);border:1px solid rgba(255,127,80,.35)}
.lvx-banner.live{background:linear-gradient(135deg,rgba(255,59,59,.25),rgba(255,92,138,.15));border-color:rgba(255,59,59,.6)}
.lvx-banner b{display:block;font-size:15px}
.lvx-banner small{display:block;color:rgba(244,244,248,.6);font-size:12px;margin-top:2px}
.lvx-banner .lvx-pill{margin-left:0}
.lv-rooms{grid-template-columns:minmax(0,1fr)}
.lv-room>div{min-width:0;flex:1}
.lv-room small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

function init() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const db = firebaseDb();
  let rooms = {};
  let shows = [];

  const title = document.querySelector(".lv-section-title");
  const banner = document.createElement("a");
  banner.className = "lvx-banner";
  banner.hidden = true;
  if (title) title.parentNode.insertBefore(banner, title);

  function card(n) {
    const a = document.querySelector('.lv-room[href="liveroom' + n + '.html"]');
    if (!a) return null;
    let pill = a.querySelector(".lvx-pill");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "lvx-pill";
      a.appendChild(pill);
    }
    const small = a.querySelector("small");
    if (small && !small.dataset.lvxDefault) small.dataset.lvxDefault = small.textContent;
    return { a, pill, small };
  }

  function render() {
    const now = Date.now();
    let liveBanner = null;
    let nextBanner = null;
    ROOMS.forEach((room, i) => {
      const n = i + 1;
      const c = card(n);
      const st = roomStatus(room, rooms[room], shows, now);
      const show = st.current || null;
      if (st.live && !liveBanner) liveBanner = { n, artist: show ? show.artist : "" };
      if (st.next && (!nextBanner || st.next.startsAt < nextBanner.show.startsAt)) nextBanner = { n, show: st.next };
      if (!c) return;
      c.a.classList.toggle("lvx-is-live", st.live);
      if (st.live) {
        c.pill.className = "lvx-pill live";
        c.pill.textContent = "LIVE";
        c.pill.hidden = false;
        if (c.small) c.small.textContent = show && show.artist ? show.artist + " · live now" : "Live now";
      } else if (st.next && st.next.startsAt - now < 14 * 24 * 60 * 60 * 1000) {
        c.pill.hidden = true;
        if (c.small) c.small.textContent = (st.next.artist ? st.next.artist + " · " : "Next show · ") + fmtWhen(st.next.startsAt, now);
      } else {
        c.pill.hidden = true;
        if (c.small) c.small.textContent = c.small.dataset.lvxDefault || "";
      }
    });

    if (liveBanner) {
      banner.className = "lvx-banner live";
      banner.href = "liveroom" + liveBanner.n + ".html";
      banner.innerHTML = '<span class="lvx-pill live">LIVE</span><span><b>' +
        esc(liveBanner.artist || "A show is live") + "</b><small>Room " + liveBanner.n + " · tap to join</small></span>";
      banner.hidden = false;
    } else if (nextBanner) {
      banner.className = "lvx-banner";
      banner.href = "liveroom" + nextBanner.n + ".html";
      banner.innerHTML = '<span class="lvx-pill">NEXT</span><span><b>' +
        esc(nextBanner.show.artist || "Next show") + "</b><small>" + esc(fmtWhen(nextBanner.show.startsAt, now)) +
        " · Room " + nextBanner.n + "</small></span>";
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  onValue(ref(db, "LiveRooms"), (snap) => { rooms = snap.val() || {}; render(); },
    (e) => console.warn("[lobby] LiveRooms", e && e.code));
  onValue(ref(db, "CONCERT_SCHEDULE"), (snap) => { shows = listShows(snap.val()); render(); },
    (e) => console.warn("[lobby] schedule", e && e.code));
  setInterval(render, 30000);
  render();
}

init();
