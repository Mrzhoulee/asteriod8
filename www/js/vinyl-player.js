// Skeuomorphic vinyl record player - vanilla JS + CSS, no deps.
// Drop a container into any page, mount with mountVinylPlayer(el, opts),
// and either pass an HTMLAudioElement (opts.audio) or call setPlaying(bool).
// Pure CSS for the visuals; Web Animations API for the spin so we can ramp
// playbackRate up on play and down to a stop on pause/ended. Works inside
// the Capacitor iOS WKWebView (Web Animations API is iOS Safari 13.1+).

const STYLE_ID = 'vinyl-player-styles';

const STYLES = `
.vinyl-player {
  position: relative;
  display: inline-block;
  width: var(--vinyl-size, 220px);
  height: var(--vinyl-size, 220px);
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.vinyl-player.size-xs { --vinyl-size: 64px; }
.vinyl-player.size-sm { --vinyl-size: 120px; }
.vinyl-player.size-md { --vinyl-size: 220px; }
.vinyl-player.size-lg { --vinyl-size: 320px; }
.vinyl-player.size-xl { --vinyl-size: 420px; }

.vp-platter {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #0a0a0a;
  box-shadow:
    0 18px 36px rgba(0,0,0,.55),
    0 2px 6px rgba(0,0,0,.4),
    inset 0 0 36px rgba(0,0,0,.6);
  overflow: hidden;
  transform: translateZ(0);
  will-change: transform;
}
/* Concentric grooves */
.vp-platter::before {
  content: '';
  position: absolute;
  inset: 2%;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle at center,
      rgba(255,255,255,.022) 0,
      rgba(255,255,255,.022) 1px,
      rgba(0,0,0,0) 1px,
      rgba(0,0,0,0) 3px
    );
  pointer-events: none;
}
/* Glossy specular highlight */
.vp-platter::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,.10), transparent 38%),
    radial-gradient(circle at 70% 80%, rgba(255,255,255,.04), transparent 40%);
  pointer-events: none;
}

.vp-label {
  position: absolute;
  left: 33%;
  top: 33%;
  width: 34%;
  height: 34%;
  border-radius: 50%;
  background: var(--vinyl-label-color, #ff7f50);
  background-image: var(--vinyl-label-image, none);
  background-size: cover;
  background-position: center;
  box-shadow:
    0 0 0 2px rgba(0,0,0,.25),
    inset 0 -3px 8px rgba(0,0,0,.25),
    inset 0 3px 8px rgba(255,255,255,.15);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.vp-label-text {
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  color: rgba(0,0,0,.6);
  font-size: calc(var(--vinyl-size, 220px) * 0.05);
  font-weight: 700;
  text-align: center;
  text-shadow: 0 1px 1px rgba(255,255,255,.2);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0 8%;
  line-height: 1.1;
  pointer-events: none;
}
/* Spindle hole */
.vp-spindle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5%;
  height: 5%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle at center, #000 0%, #1a1a1a 60%, #000 100%);
  border-radius: 50%;
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.25),
    0 1px 2px rgba(0,0,0,.6);
}

/* Tonearm */
.vp-tonearm-wrap {
  position: absolute;
  top: -6%;
  right: -6%;
  width: 65%;
  height: 65%;
  transform-origin: 100% 0%;
  transform: rotate(-32deg);
  transition: transform 0.65s cubic-bezier(.4,.0,.2,1);
  pointer-events: none;
  z-index: 3;
}
.vinyl-player.is-playing .vp-tonearm-wrap { transform: rotate(-12deg); }

.vp-tonearm-base {
  position: absolute;
  top: -2%;
  right: -2%;
  width: 18%;
  height: 18%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, #f0f0f0 0%, #b8b8b8 35%, #888 60%, #4a4a4a 100%);
  box-shadow:
    0 3px 6px rgba(0,0,0,.45),
    inset 0 -2px 4px rgba(0,0,0,.35),
    inset 0 2px 4px rgba(255,255,255,.4);
}
.vp-tonearm-base::after {
  content: '';
  position: absolute;
  inset: 30%;
  border-radius: 50%;
  background: radial-gradient(circle at center, #2a2a2a, #0a0a0a);
  box-shadow: inset 0 1px 2px rgba(255,255,255,.15);
}
.vp-tonearm-arm {
  position: absolute;
  top: 8%;
  right: 8%;
  width: 4%;
  height: 60%;
  background: linear-gradient(90deg, #555 0%, #c8c8c8 30%, #e8e8e8 50%, #b0b0b0 70%, #4a4a4a 100%);
  border-radius: 999px;
  transform-origin: 50% 0%;
  box-shadow:
    0 2px 4px rgba(0,0,0,.4),
    inset 1px 0 1px rgba(255,255,255,.35);
}
.vp-tonearm-head {
  position: absolute;
  bottom: -1%;
  left: -250%;
  width: 600%;
  height: 18%;
  background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 50%, #0a0a0a 100%);
  border-radius: 4px 4px 6px 6px;
  box-shadow:
    0 2px 5px rgba(0,0,0,.5),
    inset 0 -1px 2px rgba(0,0,0,.6),
    inset 0 1px 2px rgba(255,255,255,.1);
}
.vp-tonearm-head::after {
  content: '';
  position: absolute;
  bottom: -25%;
  left: 50%;
  transform: translateX(-50%);
  width: 8%;
  height: 30%;
  background: linear-gradient(180deg, #888, #444);
  border-radius: 0 0 2px 2px;
}

/* Subtle label glow when playing - implies sound */
.vinyl-player.is-playing .vp-label {
  animation: vp-label-glow 2.4s ease-in-out infinite alternate;
}
@keyframes vp-label-glow {
  from { box-shadow: 0 0 0 2px rgba(0,0,0,.25), inset 0 -3px 8px rgba(0,0,0,.25), inset 0 3px 8px rgba(255,255,255,.15), 0 0 0 0 rgba(255,127,80,0); }
  to   { box-shadow: 0 0 0 2px rgba(0,0,0,.25), inset 0 -3px 8px rgba(0,0,0,.25), inset 0 3px 8px rgba(255,255,255,.15), 0 0 24px 6px rgba(255,127,80,.18); }
}

@media (prefers-reduced-motion: reduce) {
  .vp-tonearm-wrap { transition: none; }
  .vinyl-player.is-playing .vp-label { animation: none; }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = STYLES;
  document.head.appendChild(s);
}

const FALLBACK_LABEL_COLORS = ['#ff7f50', '#ff5c8a', '#a78bfa', '#6ee7b7', '#fbbf24'];

export function mountVinylPlayer(host, options = {}) {
  if (!host) return null;
  ensureStyles();

  const size        = options.size || 'md';
  const labelColor  = options.labelColor || FALLBACK_LABEL_COLORS[0];
  const labelImage  = options.labelImage || null;
  const labelText   = options.labelText || '';
  const rpm         = options.rpm || 33.3;
  const audio       = options.audio || null;
  const autoStart   = !!options.autoStart;
  const idleSpeed   = typeof options.idleSpeed === 'number' ? options.idleSpeed : 0.15;
  const onTogglePlay = typeof options.onTogglePlay === 'function' ? options.onTogglePlay : null;

  host.classList.add('vinyl-player', 'size-' + size);
  host.style.setProperty('--vinyl-label-color', labelColor);
  if (labelImage) host.style.setProperty('--vinyl-label-image', `url("${String(labelImage).replace(/"/g, '%22')}")`);

  host.innerHTML = `
    <div class="vp-platter">
      <div class="vp-label">${labelText ? `<span class="vp-label-text">${escapeHtml(labelText)}</span>` : ''}</div>
      <div class="vp-spindle"></div>
    </div>
    <div class="vp-tonearm-wrap">
      <div class="vp-tonearm-base"></div>
      <div class="vp-tonearm-arm"><div class="vp-tonearm-head"></div></div>
    </div>
  `;

  const platter = host.querySelector('.vp-platter');
  const duration = (60 / rpm) * 1000;

  // Use Web Animations API so we can ramp playbackRate for accel/decel.
  const anim = platter.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
    { duration, iterations: Infinity, easing: 'linear' }
  );
  if (autoStart) {
    anim.playbackRate = idleSpeed;
  } else {
    anim.playbackRate = 0;
    try { anim.pause(); } catch (_) {}
  }

  let rampToken = 0;
  function rampPlaybackRate(target, durMs, easing) {
    const myToken = ++rampToken;
    const from = anim.playbackRate || 0;
    const start = performance.now();
    if (anim.playState === 'paused' && target > 0) {
      try { anim.play(); } catch (_) {}
    }
    function tick(now) {
      if (myToken !== rampToken) return;
      const t = Math.min(1, (now - start) / durMs);
      const eased = easing === 'easeIn'
        ? t * t
        : 1 - (1 - t) * (1 - t); // easeOut
      anim.playbackRate = from + (target - from) * eased;
      if (t < 1) requestAnimationFrame(tick);
      else if (target === 0) { try { anim.pause(); } catch (_) {} }
    }
    requestAnimationFrame(tick);
  }

  function setPlaying(isPlaying) {
    host.classList.toggle('is-playing', !!isPlaying);
    if (isPlaying) rampPlaybackRate(1, 800, 'easeIn');
    else rampPlaybackRate(autoStart ? idleSpeed : 0, 1500, 'easeOut');
  }

  function stopHard() {
    // Lift the arm and fully stop, regardless of autoStart
    host.classList.remove('is-playing');
    rampPlaybackRate(0, 1200, 'easeOut');
  }

  // Optional: click vinyl to toggle when an onTogglePlay is provided.
  if (onTogglePlay) {
    host.style.cursor = 'pointer';
    host.addEventListener('click', () => onTogglePlay());
  }

  // Auto-sync with an HTMLAudioElement.
  const teardown = [];
  if (audio) {
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    teardown.push(() => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    });
    if (!audio.paused) setPlaying(true);
  }

  function destroy() {
    teardown.forEach((fn) => fn());
    try { anim.cancel(); } catch (_) {}
    host.classList.remove('vinyl-player', 'size-' + size, 'is-playing');
    host.innerHTML = '';
  }

  return { setPlaying, stopHard, destroy, element: host };
}

// Listens to play/pause events from ANY <audio>/<video> on the page and
// drives the supplied vinyl. Useful when audio is created dynamically
// (e.g., from a click handler) and we don't have a stable reference.
export function bindVinylToPageAudio(controller) {
  if (!controller) return () => {};
  const playing = new Set();
  function onPlay(e) {
    const t = e.target;
    if (!(t instanceof HTMLMediaElement)) return;
    playing.add(t);
    controller.setPlaying(true);
  }
  function onPause(e) {
    const t = e.target;
    if (!(t instanceof HTMLMediaElement)) return;
    playing.delete(t);
    if (playing.size === 0) controller.setPlaying(false);
  }
  document.addEventListener('play',   onPlay,  true);
  document.addEventListener('pause',  onPause, true);
  document.addEventListener('ended',  onPause, true);
  return () => {
    document.removeEventListener('play',   onPlay,  true);
    document.removeEventListener('pause',  onPause, true);
    document.removeEventListener('ended',  onPause, true);
  };
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// Auto-mount any element marked with [data-vinyl]; matches the supporter-wall pattern.
function autoMount() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-vinyl]:not([data-vinyl-mounted])').forEach((el) => {
    el.setAttribute('data-vinyl-mounted', '');
    const audioSel = el.dataset.audio;
    const audio = audioSel ? document.querySelector(audioSel) : null;
    mountVinylPlayer(el, {
      size:        el.dataset.size || 'md',
      labelColor:  el.dataset.labelColor,
      labelImage:  el.dataset.labelImage,
      labelText:   el.dataset.labelText,
      autoStart:   el.dataset.idle === 'true',
      idleSpeed:   parseFloat(el.dataset.idleSpeed || '0.15'),
      audio,
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
}
