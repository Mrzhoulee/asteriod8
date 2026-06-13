// Social media posting. Three strategies, tried in order of what's configured:
//   1. SOCIAL_WEBHOOK_URL  — POST to Zapier/Make/Buffer/IFTTT, which fans out to
//      any platform (LinkedIn, Instagram, X, Facebook, Threads, TikTok…).
//   2. Platform API        — direct API call when a token is configured (X v2).
//   3. Browser compose     — returns an intent URL the main process opens, so the
//      user posts with one click. Always works as a fallback.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

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
  if (!res.ok) {
    return { success: false, error: `Webhook returned ${res.status}` };
  }
  return { success: true, method: 'webhook', platform };
}

async function postToX({ text }) {
  // OAuth2 user-context bearer token (X API v2 "create tweet").
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.detail || data.title || `X API ${res.status}` };
  }
  return { success: true, method: 'x-api', id: data?.data?.id };
}

/**
 * Returns either a completed post result, or { needsBrowser, url } telling the
 * main process to open a compose window.
 */
async function postSocial({ platform, text, link, mediaPath }) {
  const plat = (platform || 'x').toLowerCase();

  // 1. Webhook (covers every platform)
  if (process.env.SOCIAL_WEBHOOK_URL) {
    try {
      return await postViaWebhook({ platform: plat, text, link, mediaPath });
    } catch (err) {
      return { success: false, error: `Webhook failed: ${err.message}` };
    }
  }

  // 2. Direct API for X
  if ((plat === 'x' || plat === 'twitter') &&
      (process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN)) {
    try {
      return await postToX({ text });
    } catch (err) {
      return { success: false, error: `X API failed: ${err.message}` };
    }
  }

  // 3. Browser compose fallback
  const builder = COMPOSE_URLS[plat];
  if (builder) {
    return { success: true, needsBrowser: true, url: builder(text, link), platform: plat };
  }

  return {
    success: false,
    error: `No way to post to "${plat}". Set SOCIAL_WEBHOOK_URL in .env for one-click multi-platform posting, or use a supported platform: ${Object.keys(COMPOSE_URLS).join(', ')}.`,
  };
}

module.exports = { postSocial };
