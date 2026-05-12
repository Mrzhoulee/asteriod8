'use strict';

// SSR for /u/{username} — emits HTML with proper OG/Twitter meta tags,
// embeds the supporter wall + a link out to the live artist profile page.

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

exports.artistProfile = onRequest(
  { region: 'us-central1', cors: false },
  async (req, res) => {
    try {
      const m = req.path.match(/^\/u\/([^/?#]+)/);
      if (!m) return res.status(404).send('not found');
      const username = decodeURIComponent(m[1]);

      const fs = admin.firestore();
      const usersSnap = await fs.collection('users')
        .where('username', '==', username).limit(1).get();
      if (usersSnap.empty) return res.status(404).send('artist not found');

      const artistDoc = usersSnap.docs[0];
      const artistId = artistDoc.id;
      const artist = artistDoc.data();

      // Pull up to 50 supporters in signup order
      const supSnap = await fs.collection('founding_supporters')
        .where('artist_id', '==', artistId)
        .orderBy('signup_order', 'asc')
        .limit(50)
        .get();

      const supporterIds = supSnap.docs.map((d) => d.data().user_id);
      const supporterUsers = supporterIds.length
        ? await fs.getAll(...supporterIds.map((uid) => fs.collection('users').doc(uid)))
        : [];

      const supporters = supSnap.docs.map((d, i) => ({
        order: d.data().signup_order,
        user: (supporterUsers[i] && supporterUsers[i].data()) || {},
        userId: supporterIds[i],
      }));

      const refCount = artist.referral_count || 0;
      const overflow = Math.max(0, refCount - supporters.length);

      const title = `${artist.username || 'Artist'} on Asteroid`;
      const desc  = artist.bio
        ? String(artist.bio).substring(0, 160)
        : `${refCount} founding supporters`;
      const ogImage = artist.pfp || 'https://www.asteroid8.net/astei.png';
      const canonical = `https://www.asteroid8.net/u/${encodeURIComponent(artist.username || '')}`;
      const inviteUrl = artist.slug
        ? `https://www.asteroid8.net/r/${encodeURIComponent(artist.slug)}`
        : '';

      const supporterHtml = supporters.map((s) => `
        <a class="sup" href="/u/${encodeURIComponent(s.user.username || '')}">
          <img src="${esc(s.user.pfp || 'https://www.asteroid8.net/astei.png')}" alt="${esc(s.user.username || 'fan')}" loading="lazy">
          <span class="ord">#${s.order}</span>
        </a>`).join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<style>
  :root { --primary:#ff7f50; --bg:#0a0a0f; --card:rgba(255,255,255,.05); --border:rgba(255,255,255,.1); --text:#fff; --muted:rgba(255,255,255,.7); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
  .wrap{max-width:960px;margin:0 auto;padding:2rem 1rem}
  .hdr{display:flex;flex-direction:column;align-items:center;gap:1rem;padding:2rem 0}
  .pfp{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--primary)}
  h1{font-size:2rem;background:linear-gradient(135deg,#ff7f50,#ff6347);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .bio{color:var(--muted);text-align:center;max-width:560px}
  .stats{display:flex;gap:2rem;margin-top:.5rem}
  .stats .n{font-size:1.5rem;font-weight:700;color:var(--primary)}
  .stats .l{color:var(--muted);font-size:.9rem}
  .section{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-top:2rem}
  .section h2{font-size:1.25rem;margin-bottom:1rem;color:var(--primary)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:1rem}
  .sup{position:relative;display:block;text-decoration:none;color:var(--text)}
  .sup img{width:100%;aspect-ratio:1;border-radius:50%;object-fit:cover;border:2px solid var(--border);transition:transform .2s,border-color .2s}
  .sup:hover img{transform:scale(1.05);border-color:var(--primary)}
  .ord{position:absolute;bottom:-4px;right:-4px;background:var(--primary);color:#000;font-size:.7rem;font-weight:700;padding:2px 6px;border-radius:8px}
  .more{color:var(--muted);text-align:center;margin-top:1rem;font-size:.9rem}
  .empty{color:var(--muted);text-align:center;padding:2rem 0}
  .cta{display:inline-block;background:var(--primary);color:#000;font-weight:700;padding:.8rem 1.5rem;border-radius:10px;text-decoration:none;margin-top:1rem}
  @media (max-width:480px){.grid{grid-template-columns:repeat(auto-fill,minmax(60px,1fr))}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <img class="pfp" src="${esc(ogImage)}" alt="${esc(artist.username || 'artist')}">
    <h1>${esc(artist.username || 'Artist')}</h1>
    ${artist.bio ? `<p class="bio">${esc(artist.bio)}</p>` : ''}
    <div class="stats">
      <div><div class="n">${refCount}</div><div class="l">supporters</div></div>
      <div><div class="n">${esc(artist.tier || 'founder')}</div><div class="l">tier</div></div>
    </div>
    ${inviteUrl ? `<a class="cta" href="${esc(inviteUrl)}">Join via ${esc(artist.username || 'this artist')}</a>` : ''}
  </div>

  <div class="section">
    <h2>Founding Supporters</h2>
    ${supporters.length
      ? `<div class="grid">${supporterHtml}</div>${overflow ? `<p class="more">+ ${overflow} more</p>` : ''}`
      : `<p class="empty">No supporters yet. Be the first.</p>`}
  </div>
</div>
</body>
</html>`;

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
      return res.status(200).send(html);
    } catch (err) {
      logger.error('[artistProfile] error', err);
      return res.status(500).send('error');
    }
  }
);
