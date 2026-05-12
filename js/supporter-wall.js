// Supporter wall — avatar grid for an artist's public profile.
// Usage: <div id="supporterWall" data-artist-id="..."></div>
// then: import { mountSupporterWall } from './js/supporter-wall.js';
//       mountSupporterWall(document.getElementById('supporterWall'));

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const FB_CFG = {
  apiKey: "AIzaSyA-6qtVYHfipL_c6g5JzXKXCxMN5WDKU7A",
  authDomain: "asteroid8.net",
  databaseURL: "https://asteroid-cdc13-default-rtdb.firebaseio.com",
  projectId: "asteroid-cdc13",
  storageBucket: "asteroid-cdc13.appspot.com",
  messagingSenderId: "793353824502",
  appId: "1:793353824502:web:3ac24821911d14773ba4d7",
};

const app = getApps().length ? getApp() : initializeApp(FB_CFG);
const db = getFirestore(app);

const FALLBACK_AVATAR = 'https://www.asteroid8.net/astei.png';

export async function fetchSupporters(artistId, max = 50) {
  const q = query(
    collection(db, 'founding_supporters'),
    where('artist_id', '==', artistId),
    orderBy('signup_order', 'asc'),
    limit(max),
  );
  const snap = await getDocs(q);
  const ids = snap.docs.map((d) => d.data().user_id);
  const users = await Promise.all(
    ids.map((uid) => getDoc(doc(db, 'users', uid)).then((s) => s.data() || {}).catch(() => ({})))
  );
  return snap.docs.map((d, i) => ({
    order: d.data().signup_order,
    user: users[i],
    userId: ids[i],
  }));
}

export async function mountSupporterWall(host) {
  if (!host) return;
  const artistId = host.dataset.artistId;
  if (!artistId) {
    host.innerHTML = '<p class="empty">No artist specified.</p>';
    return;
  }
  host.innerHTML = '<p class="loading">Loading supporters…</p>';

  let supporters = [];
  let totalCount = 0;
  try {
    supporters = await fetchSupporters(artistId, 50);
    const artistSnap = await getDoc(doc(db, 'users', artistId));
    totalCount = (artistSnap.data() || {}).referral_count || supporters.length;
  } catch (e) {
    console.warn('[supporter-wall] load failed', e);
    host.innerHTML = '<p class="empty">Could not load supporters.</p>';
    return;
  }

  if (!supporters.length) {
    host.innerHTML = '<p class="empty">No founding supporters yet — be the first.</p>';
    return;
  }

  const overflow = Math.max(0, totalCount - supporters.length);
  const items = supporters.map((s) => `
    <a class="sup" href="/u/${encodeURIComponent(s.user.username || '')}" title="@${escapeHtml(s.user.username || 'fan')}">
      <img src="${escapeAttr(s.user.pfp || FALLBACK_AVATAR)}" alt="${escapeAttr(s.user.username || 'fan')}" loading="lazy">
      <span class="ord">#${s.order}</span>
    </a>`).join('');

  host.innerHTML = `
    <div class="grid">${items}</div>
    ${overflow ? `<p class="more">+ ${overflow} more</p>` : ''}
  `;

  // Inject default styles once
  if (!document.getElementById('supporter-wall-styles')) {
    const st = document.createElement('style');
    st.id = 'supporter-wall-styles';
    st.textContent = `
      #supporterWall .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:.75rem}
      #supporterWall .sup{position:relative;display:block;text-decoration:none;color:inherit}
      #supporterWall .sup img{width:100%;aspect-ratio:1;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.1);transition:transform .2s,border-color .2s}
      #supporterWall .sup:hover img{transform:scale(1.05);border-color:#ff7f50}
      #supporterWall .ord{position:absolute;bottom:-3px;right:-3px;background:#ff7f50;color:#000;font-size:.65rem;font-weight:700;padding:1px 5px;border-radius:6px}
      #supporterWall .more{color:rgba(255,255,255,.6);text-align:center;margin-top:.75rem;font-size:.85rem}
      #supporterWall .empty,#supporterWall .loading{color:rgba(255,255,255,.6);text-align:center;padding:1rem 0}
      @media (max-width:480px){#supporterWall .grid{grid-template-columns:repeat(auto-fill,minmax(56px,1fr))}}
    `;
    document.head.appendChild(st);
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// Auto-mount when the host element is already present at script eval time
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-supporter-wall]').forEach(mountSupporterWall);
  });
} else {
  document.querySelectorAll('[data-supporter-wall]').forEach(mountSupporterWall);
}
