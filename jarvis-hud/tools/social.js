// Social media posting. Strategies tried in order of what's configured:
//   1. SOCIAL_WEBHOOK_URL  — POST to Zapier/Make/IFTTT, fans out to any platform.
//   2. LATE_API_KEY        — Late (getlate.dev). One key posts to every connected
//      platform (Instagram, TikTok, X, LinkedIn, Facebook, YouTube, Threads, …).
//      Free signup, NO per-platform developer app needed. ← recommended.
//   3. BUFFER_ACCESS_TOKEN — Buffer Publish API (legacy; Buffer no longer issues new
//      developer tokens, so this only works if you already have one).
//   4. X_BEARER_TOKEN      — direct X/Twitter API v2.
//   5. Browser compose     — intent URL opened in the browser, always works as fallback.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── Late (getlate.dev) ───────────────────────────────────────────────────────
// One API key, every connected platform. Get a key: https://getlate.dev → API.
const LATE_BASE = 'https://getlate.dev/api/v1';
const LATE_ALIASES = { x: 'twitter' }; // user-said name → Late's platform id

function latePlatform(p) { return LATE_ALIASES[p] || p; }
function lateMediaType(url) { return /\.(mp4|mov|m4v|avi|webm)$/i.test(url) ? 'video' : 'image'; }

let _lateAccountsCache = null;
async function getLateAccounts(apiKey) {
  if (_lateAccountsCache) return _lateAccountsCache;
  const res = await fetch(`${LATE_BASE}/accounts`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Late accounts ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => ({}));
  _lateAccountsCache = Array.isArray(data) ? data : (data.accounts || data.data || []);
  return _lateAccountsCache;
}

async function postViaLate({ platform, text, link, mediaUrl, mediaUrls, hashtags }) {
  const apiKey = process.env.LATE_API_KEY;
  const want = latePlatform(platform);
  const accounts = await getLateAccounts(apiKey);

  const matched = accounts.filter((a) => (a.platform || a.provider) === want);
  if (!matched.length) {
    const connected = [...new Set(accounts.map((a) => a.platform || a.provider))].filter(Boolean).join(', ');
    return { success: false, error: `No ${platform} account connected in Late. Connected: ${connected || 'none'}. Connect it at https://getlate.dev.` };
  }

  const urls = (mediaUrls && mediaUrls.length) ? mediaUrls : (mediaUrl ? [mediaUrl] : []);
  const tags = (hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`));
  const content = [text, link, tags.join(' ')].filter(Boolean).join('\n');

  const platforms = matched.map((a) => ({ platform: want, accountId: a._id || a.accountId || a.id }));
  const body = {
    content,
    platforms,
    publishNow: true,
    ...(urls.length ? { mediaItems: urls.map((u) => ({ type: lateMediaType(u), url: u })) } : {}),
  };

  const res = await fetch(`${LATE_BASE}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    return { success: false, error: data.error || data.message || `Late ${res.status}` };
  }
  return { success: true, method: 'late', platform, postId: data._id || data.id || data.post?._id };
}

// Buffer service_type values → the platform names a user might say
const BUFFER_PLATFORM_MAP = {
  instagram: ['instagram'],
  tiktok: ['tiktok'],
  twitter: ['twitter', 'x'],
  x: ['twitter', 'x'],
  facebook: ['facebook'],
  linkedin: ['linkedin'],
  pinterest: ['pinterest'],
  mastodon: ['mastodon'],
  googlebusiness: ['google', 'googlebusiness'],
  youtube: ['youtube'],
};

// Reverse: user platform name → Buffer service_type
function bufferServiceType(platform) {
  for (const [svc, aliases] of Object.entries(BUFFER_PLATFORM_MAP)) {
    if (aliases.includes(platform)) return svc;
  }
  return platform; // try as-is
}

/** Fetch all Buffer connected profiles (cached per process run). */
let _bufferProfilesCache = null;
async function getBufferProfiles(token) {
  if (_bufferProfilesCache) return _bufferProfilesCache;
  const res = await fetch(`https://api.bufferapp.com/1/profiles.json?access_token=${token}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Buffer profiles ${res.status}: ${txt.slice(0, 200)}`);
  }
  _bufferProfilesCache = await res.json();
  return _bufferProfilesCache;
}

/**
 * Post via Buffer Publish API.
 * Matches the requested platform to connected profile(s) by service_type.
 * Supports text, link, and optional photo/video mediaUrl.
 */
async function postViaBuffer({ platform, text, link, mediaUrl }) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  const profiles = await getBufferProfiles(token);

  const svc = bufferServiceType(platform);
  const matched = profiles.filter((p) => p.service === svc);
  if (!matched.length) {
    const connected = [...new Set(profiles.map((p) => p.service))].join(', ');
    return {
      success: false,
      error: `No ${platform} account connected in Buffer. Connected: ${connected || 'none'}. Connect it at https://buffer.com`,
    };
  }

  const profileIds = matched.map((p) => p.id);
  const body = new URLSearchParams({
    access_token: token,
    text: link ? `${text}\n${link}` : text,
    now: 'true', // post immediately rather than scheduling
  });
  profileIds.forEach((id) => body.append('profile_ids[]', id));
  if (mediaUrl) body.append('media[link]', mediaUrl);

  const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    return { success: false, error: data.message || data.error || `Buffer ${res.status}` };
  }
  return {
    success: true,
    method: 'buffer',
    platform,
    profiles: matched.map((p) => p.formatted_username || p.id),
    updateIds: (data.updates || []).map((u) => u.id),
  };
}

const COMPOSE_URLS = {
  x: (text, link) =>
    `https://x.com/intent/tweet?text=${encodeURIComponent(text + (link ? '\n' + link : ''))}`,
  twitter: (text, link) =>
    `https://x.com/intent/tweet?text=${encodeURIComponent(text + (link ? '\n' + link : ''))}`,
  linkedin: (text, link) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link || 'https://')}`,
  facebook: (text, link) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link || 'https://')}&quote=${encodeURIComponent(text)}`,
  threads: (text) =>
    `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`,
  reddit: (text, link) =>
    `https://www.reddit.com/submit?title=${encodeURIComponent(text)}${link ? `&url=${encodeURIComponent(link)}` : ''}`,
};

async function postViaWebhook({ platform, text, link, mediaPath }) {
  const res = await fetch(process.env.SOCIAL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, text, link, mediaPath, source: 'jarvis-hud' }),
  });
  if (!res.ok) return { success: false, error: `Webhook returned ${res.status}` };
  return { success: true, method: 'webhook', platform };
}

async function postToX({ text }) {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.detail || data.title || `X API ${res.status}` };
  return { success: true, method: 'x-api', id: data?.data?.id };
}

/**
 * Returns either a completed post result, or { needsBrowser, url } telling the
 * main process to open a compose window.
 */
async function postSocial({ platform, text, link, mediaPath, mediaUrl, mediaUrls, hashtags }) {
  const plat = (platform || 'x').toLowerCase();
  const firstMedia = mediaUrl || (mediaUrls && mediaUrls[0]);

  // 1. Webhook (covers every platform if configured)
  if (process.env.SOCIAL_WEBHOOK_URL) {
    try {
      return await postViaWebhook({ platform: plat, text, link, mediaPath });
    } catch (err) {
      return { success: false, error: `Webhook failed: ${err.message}` };
    }
  }

  // 2. Late — one key, every connected platform (Instagram, TikTok, LinkedIn, X, …)
  if (process.env.LATE_API_KEY) {
    try {
      return await postViaLate({ platform: plat, text, link, mediaUrl, mediaUrls, hashtags });
    } catch (err) {
      return { success: false, error: `Late API failed: ${err.message}` };
    }
  }

  // 3. Buffer — legacy; only works with a pre-existing Buffer developer token
  if (process.env.BUFFER_ACCESS_TOKEN) {
    try {
      return await postViaBuffer({ platform: plat, text, link, mediaUrl: firstMedia });
    } catch (err) {
      return { success: false, error: `Buffer API failed: ${err.message}` };
    }
  }

  // 4. Direct X/Twitter API
  if ((plat === 'x' || plat === 'twitter') &&
      (process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN)) {
    try {
      return await postToX({ text });
    } catch (err) {
      return { success: false, error: `X API failed: ${err.message}` };
    }
  }

  // 5. Browser compose fallback
  const builder = COMPOSE_URLS[plat];
  if (builder) {
    return { success: true, needsBrowser: true, url: builder(text, link), platform: plat };
  }

  return {
    success: false,
    error: `No way to post to "${plat}". Set LATE_API_KEY in .env (easiest — free signup at getlate.dev, one key covers Instagram, TikTok, LinkedIn, X, Facebook, no developer apps needed). Supported browser-fallback platforms: ${Object.keys(COMPOSE_URLS).join(', ')}.`,
  };
}

module.exports = { postSocial };
