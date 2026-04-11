import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { censorProfanity } from "./text-censor.js";

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

  onValue(messagesRef, (snap) => {
    const v = snap.val();
    if (!v) {
      chatList.innerHTML = '<p class="cr-empty">No messages yet — say hi!</p>';
      return;
    }
    const rows = Object.entries(v)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .slice(-80);
    chatList.innerHTML = rows
      .map((m) => {
        const who = esc(m.sender || "Guest");
        const txt = esc(m.text || "");
        const t = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        return `<div class="cr-msg"><span class="cr-msg-meta">${who}${t ? " · " + esc(t) : ""}</span><span class="cr-msg-text">${txt}</span></div>`;
      })
      .join("");
    chatList.scrollTop = chatList.scrollHeight;
  });

  onValue(stickiesRef, (snap) => {
    const v = snap.val();
    if (!v) {
      stickyList.innerHTML = '<p class="cr-empty">No notes yet.</p>';
      return;
    }
    const rows = Object.entries(v)
      .map(([id, n]) => ({ id, ...n }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 40);
    stickyList.innerHTML = rows
      .map((n) => {
        return `<div class="cr-sticky">${esc(n.text || "")}</div>`;
      })
      .join("");
  });

  function sendChat() {
    const raw = (chatInput && chatInput.value) || "";
    const nameRaw = (chatName && chatName.value) || "Guest";
    const text = censorProfanity(raw.trim()).slice(0, 500);
    const sender = censorProfanity(nameRaw.trim()).slice(0, 40) || "Guest";
    if (!text) return;
    push(messagesRef, {
      text,
      sender,
      ts: Date.now(),
      anonId: anonId(),
    });
    chatInput.value = "";
  }

  function sendSticky() {
    const raw = (stickyInput && stickyInput.value) || "";
    const text = censorProfanity(raw.trim()).slice(0, 280);
    if (!text) return;
    push(stickiesRef, {
      text,
      ts: Date.now(),
      anonId: anonId(),
    });
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

  const unsub = onValue(stickiesRef, (snap) => {
    const v = snap.val();
    if (!v) {
      list.innerHTML = '<p class="profile-sticky-empty">No thank-you notes yet.</p>';
      return;
    }
    const rows = Object.entries(v)
      .map(([id, n]) => ({ id, ...n }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 40);
    list.innerHTML = rows.map((n) => `<div class="cr-sticky">${esc(n.text || "")}</div>`).join("");
  });

  function sendSticky() {
    const raw = (input && "value" in input && input.value) || "";
    const text = censorProfanity(String(raw).trim()).slice(0, 280);
    if (!text) return;
    push(stickiesRef, {
      text,
      ts: Date.now(),
      anonId: anonId(),
    });
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
    if (send) send.removeEventListener("click", sendSticky);
    if (input) input.removeEventListener("keydown", onKey);
  };
}
