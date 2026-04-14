import { ref, push, onValue, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { censorProfanity } from "./text-censor.js";
import { textContainsAppendixExplicit } from "./explicit-appendix.js";

function anonId() {
  let k = localStorage.getItem("concertAnonId");
  if (!k) {
    k = "a_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem("concertAnonId", k);
  }
  return k;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function stickiesAuthorKeyForPush() {
  try {
    if (typeof window !== "undefined" && typeof window.getStickiesPosterAuthorKey === "function") {
      return String(window.getStickiesPosterAuthorKey() || "").trim();
    }
  } catch (e) {}
  return "";
}

/** Hide sticky notes left while signed in, when that account is on the local block list. */
function filterStickyNotesByBlocklist(rows) {
  const blocked =
    typeof window !== "undefined" && typeof window.isEmailKeyBlocked === "function"
      ? (ak) => {
          const k = String(ak || "").trim();
          if (!k) return false;
          return window.isEmailKeyBlocked(k);
        }
      : () => false;
  return rows.filter((n) => !blocked(n.authorKey));
}

/**
 * @param {import('firebase/database').Database} db
 * @param {number} roomNum 1-5
 */
export function mountConcertDock(db, roomNum) {
  const slug = "room" + roomNum;
  const chatList = document.getElementById("concertChatList");
  const chatInput = document.getElementById("concertChatInput");
  const chatSend = document.getElementById("concertChatSend");
  const chatName = document.getElementById("concertChatName");
  const stickyList = document.getElementById("concertStickyList");
  const stickyInput = document.getElementById("concertStickyInput");
  const stickySend = document.getElementById("concertStickySend");

  if (!chatList || !stickyList) return;

  const messagesRef = ref(db, "CONCERT_CHATS/" + slug + "/messages");
  const stickiesRef = ref(db, "CONCERT_STICKIES/" + slug + "/notes");
  const roomLiveRef = ref(db, "LiveRooms/Room" + roomNum);

  let currentChatEpoch = 0;
  let lastMessagesVal = null;

  function messageMatchesEpoch(m) {
    const e = m && typeof m.epoch === "number" && !Number.isNaN(m.epoch) ? m.epoch : 0;
    return e === currentChatEpoch;
  }

  function renderChatFromCache() {
    const v = lastMessagesVal;
    if (!v) {
      chatList.innerHTML = '<p class="cr-empty">No messages yet — say hi!</p>';
      return;
    }
    const rows = Object.entries(v)
      .map(([id, m]) => ({ id, ...m }))
      .filter((m) => messageMatchesEpoch(m))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .slice(-80);
    if (!rows.length) {
      chatList.innerHTML = '<p class="cr-empty">No messages yet — say hi!</p>';
      return;
    }
    chatList.innerHTML = rows
      .map((m) => {
        const who = esc(m.sender || "Guest");
        const txt = esc(m.text || "");
        const t = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="cr-msg"><span class="cr-msg-meta">${who}${t ? " · " + esc(t) : ""}</span><span class="cr-msg-text">${txt}</span></div>`;
      })
      .join("");
    chatList.scrollTop = chatList.scrollHeight;
  }

  onValue(roomLiveRef, (snap) => {
    const d = snap.val();
    currentChatEpoch =
      d && typeof d.chatEpoch === "number" && !Number.isNaN(d.chatEpoch) ? d.chatEpoch : 0;
    renderChatFromCache();
  });

  onValue(messagesRef, (snap) => {
    lastMessagesVal = snap.val();
    renderChatFromCache();
  });

  onValue(stickiesRef, (snap) => {
    const v = snap.val();
    if (!v) {
      stickyList.innerHTML = '<p class="cr-empty">No notes yet.</p>';
      return;
    }
    const sorted = Object.entries(v)
      .map(([id, n]) => ({ id, ...n }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const rows = filterStickyNotesByBlocklist(sorted).slice(0, 40);
    if (!rows.length) {
      stickyList.innerHTML = '<p class="cr-empty">No notes to show.</p>';
      return;
    }
    stickyList.innerHTML = rows
      .map((n) => {
        const e =
          n.isExplicit === true ||
          n.isExplicit === 1 ||
          String(n.isExplicit || "").toLowerCase() === "true" ||
          textContainsAppendixExplicit(n.text || "")
            ? '<span class="explicit-badge" title="Explicit">E</span>'
            : "";
        return `<div class="cr-sticky">${e}${esc(n.text || "")}</div>`;
      })
      .join("");
  });

  async function sendChat() {
    const raw = (chatInput && chatInput.value) || "";
    const nameRaw = (chatName && chatName.value) || "Guest";
    const text = censorProfanity(raw.trim()).slice(0, 500);
    const sender = censorProfanity(nameRaw.trim()).slice(0, 40) || "Guest";
    if (!text) return;
    let epoch = currentChatEpoch;
    try {
      const rs = await get(roomLiveRef);
      const d = rs.exists() ? rs.val() : null;
      if (d && typeof d.chatEpoch === "number" && !Number.isNaN(d.chatEpoch)) {
        epoch = d.chatEpoch;
      }
    } catch (e) {
      console.warn("concert chat epoch read", e);
    }
    push(messagesRef, {
      text,
      sender,
      ts: Date.now(),
      anonId: anonId(),
      epoch,
    });
    chatInput.value = "";
  }

  function sendSticky() {
    const raw = (stickyInput && stickyInput.value) || "";
    const trimmed = raw.trim();
    const text = censorProfanity(trimmed).slice(0, 280);
    if (!text) return;
    const authorKey = stickiesAuthorKeyForPush();
    const payload = {
      text,
      ts: Date.now(),
      anonId: anonId(),
      isExplicit: textContainsAppendixExplicit(trimmed),
    };
    if (authorKey) payload.authorKey = authorKey;
    push(stickiesRef, payload);
    stickyInput.value = "";
  }

  if (chatSend) chatSend.addEventListener("click", sendChat);
  if (chatInput)
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  if (stickySend) stickySend.addEventListener("click", sendSticky);
}

/**
 * Thank-you stickies on artist profile pages (same shape as CONCERT_STICKIES).
 * @param {import('firebase/database').Database} db
 * @param {string} profileKey RTDB-safe segment, e.g. sanitized uploader email or feat_Mark
 * @param {{ list: HTMLElement, input?: HTMLElement | null, send?: HTMLElement | null }} els
 * @returns {() => void} cleanup (unsubscribe + remove listeners)
 */
export function mountThankYouStickies(db, profileKey, els) {
  const { list, input, send } = els;
  if (!db || !list) return () => {};

  const safeKey = String(profileKey || "")
    .replace(/[.#$\[\]\/#]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  if (!safeKey) return () => {};

  const stickiesRef = ref(db, "PROFILE_STICKIES/" + safeKey + "/notes");

  let lastProfileStickyVal = null;
  function renderProfileThankYouList() {
    const v = lastProfileStickyVal;
    if (!v) {
      list.innerHTML = '<p class="profile-sticky-empty">No thank-you notes yet.</p>';
      return;
    }
    const sorted = Object.entries(v)
      .map(([id, n]) => ({ id, ...n }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const rows = filterStickyNotesByBlocklist(sorted).slice(0, 40);
    if (!rows.length) {
      list.innerHTML =
        '<p class="profile-sticky-empty">No thank-you notes to show (or all hidden based on your blocks).</p>';
      return;
    }
    list.innerHTML = rows
      .map((n) => {
        const e =
          n.isExplicit === true ||
          n.isExplicit === 1 ||
          String(n.isExplicit || "").toLowerCase() === "true" ||
          textContainsAppendixExplicit(n.text || "")
            ? '<span class="explicit-badge" title="Explicit">E</span>'
            : "";
        return `<div class="cr-sticky">${e}${esc(n.text || "")}</div>`;
      })
      .join("");
  }

  const unsub = onValue(stickiesRef, (snap) => {
    lastProfileStickyVal = snap.val();
    renderProfileThankYouList();
  });
  const onBlocklistChanged = () => renderProfileThankYouList();
  window.addEventListener("asteroid-blocklist-changed", onBlocklistChanged);

  function sendSticky() {
    const raw = (input && "value" in input && input.value) || "";
    const trimmed = String(raw).trim();
    const text = censorProfanity(trimmed).slice(0, 280);
    if (!text) return;
    const authorKey = stickiesAuthorKeyForPush();
    const payload = {
      text,
      ts: Date.now(),
      anonId: anonId(),
      isExplicit: textContainsAppendixExplicit(trimmed),
    };
    if (authorKey) payload.authorKey = authorKey;
    push(stickiesRef, payload);
    if (input) input.value = "";
  }

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendSticky();
    }
  };

  if (send) send.addEventListener("click", sendSticky);
  if (input) input.addEventListener("keydown", onKey);

  return () => {
    unsub();
    window.removeEventListener("asteroid-blocklist-changed", onBlocklistChanged);
    if (send) send.removeEventListener("click", sendSticky);
    if (input) input.removeEventListener("keydown", onKey);
  };
}
