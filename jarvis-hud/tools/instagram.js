// Instagram Graph API — posting + insights for a Business/Creator account.
//
// Setup:
//   INSTAGRAM_ACCESS_TOKEN=EAAG...  (long-lived page token, ~60 days)
//   INSTAGRAM_BUSINESS_ID=17841...  (your Instagram business account ID)
//
// Getting credentials:
//   1. Your IG account must be a Business or Creator account linked to a Facebook Page.
//   2. Go to https://developers.facebook.com → create / use an existing app.
//   3. Add "Instagram Graph API" → generate a long-lived User Token with these permissions:
//      instagram_basic, instagram_content_publish, instagram_manage_insights, pages_read_engagement
//   4. Get your IG Business Account ID:
//      GET https://graph.instagram.com/me?fields=id,username&access_token=TOKEN
//   5. Refresh your token monthly: GET /oauth/access_token?grant_type=ig_refresh_token&access_token=...
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const GV = 'v21.0';

function token() { return process.env.INSTAGRAM_ACCESS_TOKEN; }
function igId()  { return process.env.INSTAGRAM_BUSINESS_ID; }

function notConfigured() {
  return { success: false, error: 'Instagram not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ID in .env.' };
}

async function igGet(path, params = {}) {
  const q = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(`https://graph.instagram.com/${GV}/${path}?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.error?.message || `IG API ${res.status}` };
  return { success: true, ...data };
}

async function igPost(path, body) {
  const res = await fetch(`https://graph.instagram.com/${GV}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.error?.message || `IG API ${res.status}` };
  return { success: true, ...data };
}

/**
 * Post a photo to Instagram.
 * @param {object} opts
 * @param {string} opts.imageUrl   Public HTTPS URL to the image
 * @param {string} opts.caption    Caption text (up to 2200 chars)
 * @param {string[]} [opts.hashtags]  Extra hashtags appended to caption
 */
async function postInstagramPhoto({ imageUrl, caption, hashtags }) {
  if (!token() || !igId()) return notConfigured();
  if (!imageUrl) return { success: false, error: 'imageUrl is required (public HTTPS URL).' };

  const fullCaption = [caption, ...(hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`))].filter(Boolean).join('\n').slice(0, 2200);

  // Step 1: create media container
  const container = await igPost(`${igId()}/media`, { image_url: imageUrl, caption: fullCaption });
  if (!container.success) return container;

  // Step 2: publish
  const result = await igPost(`${igId()}/media_publish`, { creation_id: container.id });
  if (!result.success) return result;

  return { success: true, mediaId: result.id, caption: fullCaption };
}

/**
 * Post a video (Reel) to Instagram.
 */
async function postInstagramReel({ videoUrl, caption, hashtags, coverUrl, shareToFeed = true }) {
  if (!token() || !igId()) return notConfigured();

  const fullCaption = [caption, ...(hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`))].filter(Boolean).join('\n').slice(0, 2200);

  const container = await igPost(`${igId()}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: fullCaption,
    share_to_feed: shareToFeed,
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  });
  if (!container.success) return container;

  // Reels need processing time — poll for FINISHED status
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await igGet(`${container.id}`, { fields: 'status_code' });
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') return { success: false, error: 'Video processing failed on Instagram.' };
  }

  const result = await igPost(`${igId()}/media_publish`, { creation_id: container.id });
  if (!result.success) return result;
  return { success: true, mediaId: result.id };
}

/**
 * Post a carousel (up to 10 images/videos).
 */
async function postInstagramCarousel({ mediaUrls, caption, hashtags }) {
  if (!token() || !igId()) return notConfigured();
  if (!mediaUrls?.length) return { success: false, error: 'mediaUrls array required.' };

  const fullCaption = [caption, ...(hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`))].filter(Boolean).join('\n').slice(0, 2200);

  // Step 1: create child containers
  const children = await Promise.all(mediaUrls.slice(0, 10).map((url) =>
    igPost(`${igId()}/media`, {
      ...(url.match(/\.(mp4|mov|avi)$/i) ? { media_type: 'VIDEO', video_url: url, is_carousel_item: true } : { image_url: url, is_carousel_item: true }),
    })
  ));
  const ids = children.filter((c) => c.success).map((c) => c.id);
  if (!ids.length) return { success: false, error: 'All media containers failed.' };

  // Step 2: carousel container
  const carousel = await igPost(`${igId()}/media`, {
    media_type: 'CAROUSEL',
    children: ids.join(','),
    caption: fullCaption,
  });
  if (!carousel.success) return carousel;

  // Step 3: publish
  const result = await igPost(`${igId()}/media_publish`, { creation_id: carousel.id });
  return result.success ? { success: true, mediaId: result.id } : result;
}

/**
 * Get account-level insights.
 */
async function getInstagramInsights({ period = 'day', since, until, metrics } = {}) {
  if (!token() || !igId()) return notConfigured();

  const defaultMetrics = ['reach', 'impressions', 'profile_views', 'website_clicks', 'follower_count'];
  const params = {
    metric: (metrics || defaultMetrics).join(','),
    period,
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
  };
  return igGet(`${igId()}/insights`, params);
}

/** Get recent media with engagement stats. */
async function getInstagramMedia({ limit = 10 } = {}) {
  if (!token() || !igId()) return notConfigured();
  return igGet(`${igId()}/media`, {
    fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink',
    limit: Math.min(limit, 50),
  });
}

module.exports = { postInstagramPhoto, postInstagramReel, postInstagramCarousel, getInstagramInsights, getInstagramMedia };
