/* Shared mini-player for Asteroid pages.
   Sticky bottom bar + a queue popup window (black/coral theme).
   Single audio element — prevents two songs playing at once by
   pausing other <audio> elements and swapping window.currentPlaying.
   Exposes window.AsteroidPlayer = { play, enqueue, next, pause, toggle, openQueue, closeQueue, state }.
*/
(function () {
  if (window.AsteroidPlayer) return; // single init per page

  const queue = [];          // [{url, title, artist, imageUrl}]
  let current = null;        // {url, title, artist, imageUrl}
  let audio = null;          // HTMLAudioElement
  let bar = null;            // sticky bar root
  let popup = null;          // queue popup root
  let els = {};              // cached inner nodes

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // --- Firebase persistence (saves queue adds to PLAYLISTS/<uid>/<songId>) ---
  // Uses the same globals and path that index.html's "save to playlist" writes to,
  // so queued songs show up in the user's pat.html playlist too.
  function currentUserKey() {
    try {
      const emailLike =
        (localStorage.getItem('userEmail') ||
          localStorage.getItem('email') ||
          localStorage.getItem('CurrentUser') ||
          '').trim();
      if (!emailLike) return '';
      return emailLike.replace(/[.#$[\]]/g, '_');
    } catch (e) { return ''; }
  }
  function songIdFromUrl(url) {
    return String(url || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180) || 'song_' + Date.now();
  }
  function firebaseSaveToPlaylist(song) {
    try {
      const uid = currentUserKey();
      const db = window.firebaseDatabase;
      const refFn = window.firebaseRef;
      const setFn = window.firebaseSet;
      if (!uid || !db || !refFn || !setFn || !song || !song.url) return;
      const sid = songIdFromUrl(song.url);
      setFn(refFn(db, 'PLAYLISTS/' + uid + '/' + sid), {
        title: song.title || 'Untitled',
        artist: song.artist || 'Unknown artist',
        src: song.url,
        imageUrl: song.imageUrl || '',
        addedAt: Date.now(),
        source: 'queue'
      }).catch(err => console.warn('[miniplayer] playlist save failed:', err));
    } catch (e) {
      console.warn('[miniplayer] firebaseSaveToPlaylist error:', e);
    }
  }
  function firebaseRemoveFromPlaylist(song) {
    try {
      const uid = currentUserKey();
      const db = window.firebaseDatabase;
      const refFn = window.firebaseRef;
      const rmFn = window.firebaseRemove;
      if (!uid || !db || !refFn || !rmFn || !song || !song.url) return;
      const sid = songIdFromUrl(song.url);
      rmFn(refFn(db, 'PLAYLISTS/' + uid + '/' + sid))
        .catch(err => console.warn('[miniplayer] playlist remove failed:', err));
    } catch (e) {
      console.warn('[miniplayer] firebaseRemoveFromPlaylist error:', e);
    }
  }

  function injectStyles() {
    if (document.getElementById('asteroid-miniplayer-style')) return;
    const s = document.createElement('style');
    s.id = 'asteroid-miniplayer-style';
    s.textContent = `
      #asteroid-miniplayer {
        position: fixed; left: 0; right: 0;
        bottom: calc(56px + env(safe-area-inset-bottom, 0px));
        z-index: 9500;
        background: linear-gradient(180deg, rgba(10,10,10,0.97), #000);
        border-top: 1px solid rgba(255,127,80,0.45);
        color: #fff;
        font-family: 'Poppins', system-ui, -apple-system, sans-serif;
        display: none;
      }
      #asteroid-miniplayer.open { display: block; }
      /* Pages without a bottom nav can override via body[data-amp-nobottomnav] */
      body[data-amp-nobottomnav] #asteroid-miniplayer { bottom: env(safe-area-inset-bottom, 0px); }
      .amp-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
      .amp-art {
        width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0;
        background: linear-gradient(135deg, #ff7f50, #e66a3a);
        display: flex; align-items: center; justify-content: center;
        color: #000; font-weight: 800; overflow: hidden; font-size: 16px;
      }
      .amp-art img { width: 100%; height: 100%; object-fit: cover; }
      .amp-meta { flex: 1; min-width: 0; }
      .amp-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
      .amp-sub { font-size: 11px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .amp-btn {
        width: 38px; height: 38px; border-radius: 50%;
        border: 1px solid rgba(255,127,80,0.5);
        background: rgba(255,127,80,0.12); color: #fff;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; padding: 0; position: relative;
      }
      .amp-btn:hover { background: rgba(255,127,80,0.26); }
      .amp-btn .material-symbols-outlined, .amp-btn .material-icons { font-size: 22px; color: #ff7f50; }
      .amp-queue-badge {
        position: absolute; top: -4px; right: -4px;
        background: #ff7f50; color: #000;
        font-size: 10px; font-weight: 800;
        min-width: 16px; height: 16px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; padding: 0 4px;
      }
      .amp-queue-badge[hidden] { display: none; }
      .amp-progress { height: 3px; background: rgba(255,255,255,0.1); position: relative; overflow: hidden; }
      .amp-progress-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #ff7f50, #e66a3a); transition: width 0.2s linear; }
      @media (max-width: 480px) { .amp-row { padding: 6px 10px; gap: 8px; } .amp-art { width: 36px; height: 36px; } }

      /* Queue popup */
      #asteroid-queue-popup {
        position: fixed; inset: 0; z-index: 9700;
        background: rgba(0,0,0,0.78);
        display: none; align-items: center; justify-content: center;
        padding: 16px; box-sizing: border-box;
      }
      #asteroid-queue-popup.open { display: flex; }
      .aqp-box {
        background: #000;
        border: 1px solid rgba(255,127,80,0.55);
        border-radius: 18px;
        width: 100%; max-width: 460px;
        max-height: 82vh; overflow: hidden;
        display: flex; flex-direction: column;
        color: #fff; font-family: 'Poppins', system-ui, sans-serif;
        box-shadow: 0 20px 60px rgba(255,127,80,0.15), 0 0 0 1px rgba(255,127,80,0.08) inset;
      }
      .aqp-head {
        display: flex; align-items: center; gap: 10px;
        padding: 16px 18px;
        border-bottom: 1px solid rgba(255,127,80,0.25);
        background: linear-gradient(135deg, rgba(255,127,80,0.12), transparent);
      }
      .aqp-title {
        flex: 1; margin: 0; font-family: 'Montserrat', 'Poppins', sans-serif;
        font-size: 18px; font-weight: 800; color: #ff7f50;
        display: flex; align-items: center; gap: 8px;
      }
      .aqp-close {
        background: transparent; color: #ff7f50;
        border: 1px solid rgba(255,127,80,0.45);
        width: 32px; height: 32px; border-radius: 50%;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
      .aqp-close:hover { background: rgba(255,127,80,0.14); }
      .aqp-now {
        padding: 12px 18px; border-bottom: 1px solid rgba(255,127,80,0.18);
        font-size: 12px; color: rgba(255,255,255,0.75);
      }
      .aqp-now-label { color: #ff7f50; font-weight: 700; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
      .aqp-now-title { font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aqp-now-sub { font-size: 11px; color: rgba(255,255,255,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aqp-list {
        flex: 1; overflow-y: auto; padding: 8px 10px 18px;
      }
      .aqp-empty {
        text-align: center; padding: 36px 18px;
        color: rgba(255,255,255,0.6); font-size: 13px;
      }
      .aqp-empty strong { display: block; color: #ff7f50; margin-bottom: 6px; font-size: 14px; }
      .aqp-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; border-radius: 10px;
        border: 1px solid rgba(255,127,80,0.12);
        background: rgba(255,127,80,0.04);
        margin: 6px 0;
      }
      .aqp-item:hover { border-color: rgba(255,127,80,0.4); background: rgba(255,127,80,0.08); }
      .aqp-item-idx { width: 22px; color: #ff7f50; font-weight: 700; font-size: 12px; text-align: center; }
      .aqp-item-art {
        width: 34px; height: 34px; border-radius: 6px; overflow: hidden;
        background: linear-gradient(135deg, #ff7f50, #e66a3a);
        display: flex; align-items: center; justify-content: center;
        color: #000; font-weight: 800; flex-shrink: 0;
      }
      .aqp-item-art img { width: 100%; height: 100%; object-fit: cover; }
      .aqp-item-meta { flex: 1; min-width: 0; }
      .aqp-item-title { font-size: 13px; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aqp-item-sub { font-size: 11px; color: rgba(255,255,255,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aqp-item-btn {
        background: transparent; border: 1px solid rgba(255,127,80,0.4);
        color: #ff7f50; width: 32px; height: 32px; border-radius: 8px;
        cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .aqp-item-btn:hover { background: rgba(255,127,80,0.16); }
      .aqp-foot {
        display: flex; gap: 8px; padding: 12px 14px;
        border-top: 1px solid rgba(255,127,80,0.22);
        background: rgba(255,127,80,0.04);
      }
      .aqp-foot button {
        flex: 1; padding: 10px 12px; border-radius: 10px;
        font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: 700;
        cursor: pointer; border: 1px solid rgba(255,127,80,0.45);
        background: transparent; color: #ff7f50;
      }
      .aqp-foot button.primary { background: linear-gradient(135deg, #ff7f50, #e66a3a); color: #000; border-color: transparent; }
      .aqp-foot button:hover { background: rgba(255,127,80,0.14); }
      .aqp-foot button.primary:hover { filter: brightness(1.08); }
    `;
    document.head.appendChild(s);
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.id = 'asteroid-miniplayer';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Now playing');
    bar.innerHTML = `
      <div class="amp-progress"><div class="amp-progress-bar"></div></div>
      <div class="amp-row">
        <div class="amp-art" data-el="art">♪</div>
        <div class="amp-meta">
          <div class="amp-title" data-el="title">—</div>
          <div class="amp-sub" data-el="sub">Nothing playing</div>
        </div>
        <button class="amp-btn" data-act="toggle" aria-label="Play/pause">
          <span class="material-symbols-outlined" data-el="toggleIcon">play_arrow</span>
        </button>
        <button class="amp-btn" data-act="next" aria-label="Next in queue">
          <span class="material-symbols-outlined">skip_next</span>
        </button>
        <button class="amp-btn" data-act="queue" aria-label="Open queue">
          <span class="material-symbols-outlined">queue_music</span>
          <span class="amp-queue-badge" data-el="qbadge" hidden>0</span>
        </button>
      </div>
    `;
    document.body.appendChild(bar);
    els.art = bar.querySelector('[data-el="art"]');
    els.title = bar.querySelector('[data-el="title"]');
    els.sub = bar.querySelector('[data-el="sub"]');
    els.toggleIcon = bar.querySelector('[data-el="toggleIcon"]');
    els.qbadge = bar.querySelector('[data-el="qbadge"]');
    els.progress = bar.querySelector('.amp-progress-bar');
    bar.querySelector('[data-act="toggle"]').addEventListener('click', toggle);
    bar.querySelector('[data-act="next"]').addEventListener('click', next);
    bar.querySelector('[data-act="queue"]').addEventListener('click', openQueue);
  }

  function buildPopup() {
    popup = document.createElement('div');
    popup.id = 'asteroid-queue-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', 'Play queue');
    popup.innerHTML = `
      <div class="aqp-box" role="document">
        <div class="aqp-head">
          <h3 class="aqp-title"><span class="material-symbols-outlined">queue_music</span>Queue</h3>
          <button class="aqp-close" aria-label="Close queue">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="aqp-now" data-el="now"></div>
        <div class="aqp-list" data-el="list"></div>
        <div class="aqp-foot">
          <button data-act="clear">Clear queue</button>
          <button class="primary" data-act="done">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
    els.popupList = popup.querySelector('[data-el="list"]');
    els.popupNow = popup.querySelector('[data-el="now"]');
    popup.querySelector('.aqp-close').addEventListener('click', closeQueue);
    popup.querySelector('[data-act="done"]').addEventListener('click', closeQueue);
    popup.querySelector('[data-act="clear"]').addEventListener('click', () => {
      const toRemove = queue.slice();
      queue.length = 0;
      toRemove.forEach(firebaseRemoveFromPlaylist);
      renderPopup();
      render();
    });
    popup.addEventListener('click', (e) => {
      if (e.target === popup) closeQueue();
    });
  }

  function ensureUI() {
    if (!bar || !popup) {
      injectStyles();
      const go = () => {
        if (!bar) buildBar();
        if (!popup) buildPopup();
      };
      if (document.body) go();
      else document.addEventListener('DOMContentLoaded', go, { once: true });
    }
  }

  function pauseOtherAudio(except) {
    document.querySelectorAll('audio').forEach(a => {
      if (a !== except && !a.paused) { try { a.pause(); } catch (e) {} }
    });
    if (window.currentPlaying && window.currentPlaying !== except) {
      try { window.currentPlaying.pause(); } catch (e) {}
    }
    window.currentPlaying = except || null;
  }

  function render() {
    if (!bar) return;
    bar.classList.toggle('open', !!current);
    if (els.qbadge) {
      if (queue.length) {
        els.qbadge.textContent = String(queue.length);
        els.qbadge.hidden = false;
      } else {
        els.qbadge.hidden = true;
      }
    }
    if (!current) return;
    const initial = (current.title || '?').toString().trim().charAt(0).toUpperCase() || '♪';
    if (current.imageUrl) {
      els.art.innerHTML = `<img src="${esc(current.imageUrl)}" alt="">`;
    } else {
      els.art.textContent = initial;
    }
    els.title.textContent = current.title || 'Untitled';
    els.sub.textContent = current.artist || '';
    els.toggleIcon.textContent = (audio && !audio.paused) ? 'pause' : 'play_arrow';
  }

  function renderPopup() {
    if (!popup) return;
    if (current) {
      const initial = (current.title || '?').toString().trim().charAt(0).toUpperCase() || '♪';
      const artHtml = current.imageUrl
        ? `<img src="${esc(current.imageUrl)}" alt="">`
        : esc(initial);
      els.popupNow.innerHTML = `
        <div class="aqp-now-label">Now playing</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="aqp-item-art" style="width:40px;height:40px;">${artHtml}</div>
          <div style="flex:1;min-width:0;">
            <div class="aqp-now-title">${esc(current.title || 'Untitled')}</div>
            <div class="aqp-now-sub">${esc(current.artist || '')}</div>
          </div>
        </div>
      `;
    } else {
      els.popupNow.innerHTML = '<div class="aqp-now-label">Now playing</div><div class="aqp-now-sub">Nothing playing</div>';
    }
    if (!queue.length) {
      els.popupList.innerHTML = `
        <div class="aqp-empty">
          <strong>Queue is empty</strong>
          Add songs with the "Queue" button on any featured track.
        </div>`;
      return;
    }
    els.popupList.innerHTML = queue.map((q, i) => {
      const initial = (q.title || '?').toString().trim().charAt(0).toUpperCase() || '♪';
      const artHtml = q.imageUrl ? `<img src="${esc(q.imageUrl)}" alt="">` : esc(initial);
      return `
        <div class="aqp-item">
          <div class="aqp-item-idx">${i + 1}</div>
          <div class="aqp-item-art">${artHtml}</div>
          <div class="aqp-item-meta">
            <div class="aqp-item-title">${esc(q.title || 'Untitled')}</div>
            <div class="aqp-item-sub">${esc(q.artist || '')}</div>
          </div>
          <button class="aqp-item-btn" data-act="play" data-i="${i}" aria-label="Play now">
            <span class="material-symbols-outlined">play_arrow</span>
          </button>
          <button class="aqp-item-btn" data-act="remove" data-i="${i}" aria-label="Remove">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>`;
    }).join('');
    els.popupList.querySelectorAll('.aqp-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const act = btn.dataset.act;
        if (isNaN(i) || !queue[i]) return;
        if (act === 'play') {
          const song = queue.splice(i, 1)[0];
          playSong(song);
          renderPopup();
        } else if (act === 'remove') {
          const removed = queue.splice(i, 1)[0];
          if (removed) firebaseRemoveFromPlaylist(removed);
          renderPopup();
          render();
        }
      });
    });
  }

  function recordPlayToTrending(song) {
    try {
      const title = (song && song.title || '').toString().trim();
      if (!title) return;
      // Prefer the canonical recorder if loaded (handles dedup across the whole app)
      if (typeof window.recordSongPlay === 'function') {
        window.recordSongPlay(title);
        return;
      }
      // Standalone fallback (charts.html, pat.html — pages without index.html's recorder)
      const db = window.firebaseDatabase;
      const refFn = window.firebaseRef;
      const pushFn = window.firebasePush;
      if (!db || !refFn || !pushFn) return;
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const ofctime = months[new Date().getMonth()];
      const now = Date.now();
      const dupKey = title + '|' + ofctime;
      if (window.__lastSongplayedKey === dupKey && now - (window.__lastSongplayedTs || 0) < 3000) return;
      window.__lastSongplayedKey = dupKey;
      window.__lastSongplayedTs = now;
      pushFn(refFn(db, 'songplayed'), { title2: title, ofctime });
    } catch (e) { console.warn('[miniplayer] recordPlayToTrending', e); }
  }

  function playSong(song) {
    ensureUI();
    if (!song || !song.url) return;
    recordPlayToTrending(song);
    if (audio) {
      try { audio.pause(); } catch (e) {}
      audio.src = '';
    }
    audio = new Audio(song.url);
    audio.preload = 'auto';
    audio.addEventListener('ended', () => { next(); });
    audio.addEventListener('play', () => { render(); renderPopup(); });
    audio.addEventListener('pause', () => { render(); });
    audio.addEventListener('timeupdate', () => {
      if (!audio || !audio.duration || !els.progress) return;
      els.progress.style.width = ((audio.currentTime / audio.duration) * 100) + '%';
    });
    pauseOtherAudio(audio);
    current = song;
    audio.play().catch(() => {});
    render();
    renderPopup();
  }

  function play(song) { playSong(song); }

  function enqueue(song) {
    ensureUI();
    if (!song || !song.url) return;
    firebaseSaveToPlaylist(song);
    if (!current) {
      playSong(song);
    } else {
      queue.push(song);
      render();
      renderPopup();
    }
  }

  function next() {
    if (queue.length) {
      playSong(queue.shift());
    } else {
      if (audio) { try { audio.pause(); } catch (e) {} }
      if (els && els.progress) els.progress.style.width = '0%';
      current = null;
      render();
      renderPopup();
    }
  }

  function toggle() {
    if (!audio) return;
    if (audio.paused) {
      pauseOtherAudio(audio);
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function pause() { if (audio && !audio.paused) audio.pause(); }

  function openQueue() {
    ensureUI();
    renderPopup();
    if (popup) popup.classList.add('open');
  }

  function closeQueue() {
    if (popup) popup.classList.remove('open');
  }

  function state() {
    return {
      current: current ? { ...current } : null,
      queue: queue.slice(),
      playing: !!(audio && !audio.paused)
    };
  }

  ensureUI();

  // Single-song enforcement: when ANY <audio> on the page starts playing, pause the others.
  // This catches inline onclick="audio.play()" patterns on legacy pages (index.html featured cards).
  document.addEventListener('play', (e) => {
    const t = e.target;
    if (!t || t.tagName !== 'AUDIO') return;
    pauseOtherAudio(t);
  }, true);

  window.AsteroidPlayer = { play, enqueue, next, pause, toggle, openQueue, closeQueue, state };
})();
