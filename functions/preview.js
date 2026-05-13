'use strict';

// Phase 2 — Public track preview pages.
// /t/{trackId}        → SSR HTML with OG meta + audio player + signup wall
// /api/preview-audio/{trackId}.m4a → 30s preview stream (transcoded once, cached in Storage)

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const path = require('path');
const fs_node = require('fs');
const os = require('os');

const POSTHOG_API_HOST = process.env.POSTHOG_API_HOST || 'https://us.i.posthog.com';
const POSTHOG_PROJECT_KEY = defineSecret('POSTHOG_PROJECT_KEY');

let ffmpeg, ffmpegPath;
function loadFfmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffmpeg = require('fluent-ffmpeg');
  ffmpeg.setFfmpegPath(ffmpegPath);
  return ffmpeg;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
// /t/{trackId} — SSR
// ─────────────────────────────────────────────────────────────
exports.trackPreview = onRequest(
  { region: 'us-central1', cors: false, secrets: [POSTHOG_PROJECT_KEY] },
  async (req, res) => {
    try {
      const m = req.path.match(/^\/t\/([^/?#]+)/);
      if (!m) return res.status(404).send('not found');
      const trackId = decodeURIComponent(m[1]);

      const fs = admin.firestore();
      const songSnap = await fs.collection('songs').doc(trackId).get();
      if (!songSnap.exists) return res.status(404).send('track not found');

      const song = songSnap.data() || {};
      const ownerUid = song.ownerUid || '';
      let artist = {};
      if (ownerUid) {
        const artistSnap = await fs.collection('users').doc(ownerUid).get();
        if (artistSnap.exists) artist = artistSnap.data();
      }

      const title = `${song.title || 'Track'} — ${artist.username || 'Artist'}`;
      const desc = `${artist.username || 'Artist'} • Listen on Asteroid`;
      const artwork = song.artworkUrl || artist.pfp || 'https://www.asteroid8.net/astei.png';
      const canonical = `https://www.asteroid8.net/t/${encodeURIComponent(trackId)}`;
      const previewUrl = `/api/preview-audio/${encodeURIComponent(trackId)}.m4a`;
      const phKey = process.env.POSTHOG_PROJECT_KEY || '';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="music.song">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(artwork)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:audio" content="${esc(canonical + previewUrl)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(artwork)}">

<link rel="apple-touch-icon" href="${esc(artwork)}">
<meta name="apple-itunes-app" content="app-id=6752210015, app-argument=asteroid://t/${esc(trackId)}">

<style>
  :root{--primary:#ff7f50;--bg:#0a0a0f;--card:rgba(255,255,255,.06);--border:rgba(255,255,255,.12);--text:#fff;--muted:rgba(255,255,255,.7)}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:radial-gradient(ellipse at top,#1a0b2e 0%,var(--bg) 60%);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:1.5rem}
  .card{width:100%;max-width:480px;background:var(--card);border:1px solid var(--border);border-radius:24px;padding:1.5rem;backdrop-filter:blur(20px)}
  .vinyl-wrap{display:flex;justify-content:center;padding:1rem 0 .5rem}
  #vinyl{--vinyl-size:min(78vw,360px)}
  h1{font-size:1.5rem;margin:1rem 0 .25rem;line-height:1.2}
  .artist{color:var(--muted);margin-bottom:1rem}
  .player{width:100%;margin:1rem 0}
  .wall{display:none;background:rgba(255,127,80,.08);border:1px solid rgba(255,127,80,.3);border-radius:16px;padding:1.25rem;margin-top:1rem;text-align:center}
  .wall.show{display:block;animation:fadein .4s ease}
  @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .wall p{margin-bottom:1rem;color:var(--muted)}
  .btn{display:inline-block;background:var(--primary);color:#000;font-weight:700;padding:.85rem 1.4rem;border-radius:12px;text-decoration:none;border:none;cursor:pointer;font-size:1rem}
  .btn.secondary{background:transparent;color:var(--primary);border:1px solid var(--primary);margin-left:.5rem}
  .ts{display:flex;justify-content:space-between;color:var(--muted);font-size:.85rem;margin-top:.5rem}
  footer{margin-top:2rem;color:var(--muted);font-size:.8rem}
  footer a{color:var(--primary);text-decoration:none}
</style>
</head>
<body>
<div class="card">
  <div class="vinyl-wrap">
    <div id="vinyl"
         data-size="lg"
         data-label-image="${esc(artwork)}"
         data-label-color="#ff7f50"></div>
  </div>
  <h1>${esc(song.title || 'Untitled')}</h1>
  <div class="artist">${esc(artist.username || 'Artist')}</div>

  <audio id="audio" class="player" preload="metadata" controls
         src="${esc(previewUrl)}"></audio>
  <div class="ts"><span id="cur">0:00</span><span>0:30 preview</span></div>

  <div id="wall" class="wall">
    <p>Sign up to keep listening, follow ${esc(artist.username || 'this artist')}, and discover similar tracks.</p>
    <a class="btn" href="/join?from=${encodeURIComponent('t/' + trackId)}" id="signup">Sign up free</a>
    <a class="btn secondary" href="/u/${encodeURIComponent(artist.username || '')}">Artist page</a>
  </div>
</div>

<footer>Asteroid — <a href="/">asteroid8.net</a></footer>

<script type="module">
  import { mountVinylPlayer } from '/js/vinyl-player.js';
  const audio = document.getElementById('audio');
  const vinyl = mountVinylPlayer(document.getElementById('vinyl'), {
    size: 'lg',
    labelImage: ${JSON.stringify(artwork)},
    audio,
    onTogglePlay: () => { if (audio.paused) audio.play(); else audio.pause(); },
  });
  window.__vinyl = vinyl;
</script>
<script>
  // PostHog — best-effort
  (function(){
    var key = ${JSON.stringify(phKey)};
    var host = ${JSON.stringify(POSTHOG_API_HOST)};
    if(!key) { window.posthog = { capture: function(){}, identify: function(){} }; return; }
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init(key, {api_host: host, person_profiles:'identified_only', capture_pageview:false});
  })();

  var trackId = ${JSON.stringify(trackId)};
  posthog.capture('track_share_viewed', { track_id: trackId });

  var audio = document.getElementById('audio');
  var wall  = document.getElementById('wall');
  var cur   = document.getElementById('cur');
  var played = false, completed = false;

  function fmt(s){var m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+(x<10?'0':'')+x;}

  audio.addEventListener('play', function(){
    if(!played){ played = true; posthog.capture('preview_played', { track_id: trackId }); }
  });
  audio.addEventListener('timeupdate', function(){
    cur.textContent = fmt(audio.currentTime);
    if(audio.currentTime >= 30 && !completed){
      completed = true;
      audio.pause();
      try{ audio.currentTime = 30; }catch(e){}
      wall.classList.add('show');
      try{ window.__vinyl && window.__vinyl.stopHard(); }catch(e){}
      posthog.capture('preview_completed', { track_id: trackId });
    }
  });
  audio.addEventListener('ended', function(){
    if(!completed){ completed = true; wall.classList.add('show'); posthog.capture('preview_completed', { track_id: trackId }); }
  });
  document.getElementById('signup').addEventListener('click', function(){
    posthog.capture('preview_signup_started', { track_id: trackId });
  });
</script>
</body>
</html>`;

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=60, s-maxage=600');
      return res.status(200).send(html);
    } catch (err) {
      logger.error('[trackPreview] error', err);
      return res.status(500).send('error');
    }
  }
);

// ─────────────────────────────────────────────────────────────
// /api/preview-audio/{trackId}.m4a — 30s preview, cached in Cloud Storage
// ─────────────────────────────────────────────────────────────
exports.previewAudio = onRequest(
  { region: 'us-central1', cors: false, memory: '1GiB', timeoutSeconds: 60 },
  async (req, res) => {
    try {
      const m = req.path.match(/^\/api\/preview-audio\/([^/]+)\.m4a$/);
      if (!m) return res.status(404).send('not found');
      const trackId = decodeURIComponent(m[1]);

      const bucket = admin.storage().bucket();
      const previewObj = bucket.file(`previews/${trackId}.m4a`);
      const [exists] = await previewObj.exists();

      if (!exists) {
        // Lazy transcode on first hit
        const songSnap = await admin.firestore().collection('songs').doc(trackId).get();
        if (!songSnap.exists) return res.status(404).send('track not found');
        // studio.html writes the download URL to `fileInp`. We support audioUrl /
        // audioStoragePath / downloadUrl as fallbacks for future schema variations.
        const s = songSnap.data() || {};
        const audioUrl = s.fileInp || s.audioUrl || s.downloadUrl;
        const audioStoragePath = s.audioStoragePath;
        if (!audioUrl && !audioStoragePath) {
          return res.status(404).send('no audio source');
        }

        loadFfmpeg();
        const tmpIn  = path.join(os.tmpdir(), `${trackId}-src`);
        const tmpOut = path.join(os.tmpdir(), `${trackId}-30s.m4a`);

        if (audioStoragePath) {
          await bucket.file(audioStoragePath).download({ destination: tmpIn });
        } else {
          const r = await fetch(audioUrl);
          if (!r.ok) return res.status(502).send('upstream fetch failed');
          fs_node.writeFileSync(tmpIn, Buffer.from(await r.arrayBuffer()));
        }

        await new Promise((resolve, reject) => {
          ffmpeg(tmpIn)
            .setStartTime(0).duration(30)
            .audioCodec('aac').audioBitrate('128k')
            .format('mp4').outputOptions(['-movflags', 'frag_keyframe+empty_moov'])
            .on('end', resolve).on('error', reject)
            .save(tmpOut);
        });

        await bucket.upload(tmpOut, {
          destination: `previews/${trackId}.m4a`,
          metadata: {
            contentType: 'audio/mp4',
            cacheControl: 'public, max-age=31536000, immutable',
          },
        });
        try { fs_node.unlinkSync(tmpIn); fs_node.unlinkSync(tmpOut); } catch (_) {}
      }

      const [signedUrl] = await previewObj.getSignedUrl({
        action: 'read', expires: Date.now() + 24 * 60 * 60 * 1000,
      });
      res.set('Cache-Control', 'public, max-age=86400, immutable');
      return res.redirect(302, signedUrl);
    } catch (err) {
      logger.error('[previewAudio] error', err);
      return res.status(500).send('error');
    }
  }
);
