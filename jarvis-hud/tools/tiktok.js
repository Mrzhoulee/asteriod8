// TikTok Content Publishing API + Business Data API.
//
// Setup (Business/Creator account required):
//   TIKTOK_CLIENT_KEY=aw...
//   TIKTOK_ACCESS_TOKEN=act...  (long-lived token from TikTok for Developers)
//   TIKTOK_OPEN_ID=...          (your TikTok user ID — returned during OAuth)
//
// Getting credentials:
//   1. Create an app at https://developers.tiktok.com
//   2. Add "Content Posting API" and "Research API" products
//   3. Complete OAuth flow to get access_token and open_id
//   4. Paste them in .env — they're long-lived (refresh monthly via TikTok portal)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE = 'https://open.tiktokapis.com/v2';
const MAX_CAPTION = 2200;

function headers() {
  return {
    Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}`,
    'Content-Type': 'application/json; charset=UTF-8',
  };
}

function notConfigured() {
  return { success: false, error: 'TikTok not configured. Set TIKTOK_ACCESS_TOKEN and TIKTOK_OPEN_ID in .env.' };
}

/**
 * Initiate a video upload (PULL_FROM_URL method — TikTok fetches the video
 * from a public URL, e.g. a Cloudflare R2 / S3 link).
 */
async function postTikTokVideo({ videoUrl, caption, disableDuet = false, disableStitch = false, disableComment = false, privacy = 'PUBLIC_TO_EVERYONE' }) {
  if (!process.env.TIKTOK_ACCESS_TOKEN || !process.env.TIKTOK_OPEN_ID) return notConfigured();
  if (!videoUrl) return { success: false, error: 'videoUrl is required (public HTTPS URL to the video file).' };

  const body = {
    post_info: {
      title: (caption || '').slice(0, MAX_CAPTION),
      privacy_level: privacy,
      disable_duet: disableDuet,
      disable_stitch: disableStitch,
      disable_comment: disableComment,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl,
    },
  };

  const res = await fetch(`${BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error?.code !== 'ok') {
    return { success: false, error: data.error?.message || `TikTok API ${res.status}` };
  }
  return { success: true, publishId: data.data?.publish_id };
}

/**
 * Post a photo carousel (up to 35 photos) from public URLs.
 */
async function postTikTokPhotos({ photoUrls, caption, privacy = 'PUBLIC_TO_EVERYONE' }) {
  if (!process.env.TIKTOK_ACCESS_TOKEN || !process.env.TIKTOK_OPEN_ID) return notConfigured();
  if (!photoUrls?.length) return { success: false, error: 'photoUrls array is required.' };

  const body = {
    post_info: {
      title: (caption || '').slice(0, MAX_CAPTION),
      privacy_level: privacy,
      disable_duet: true,
      disable_comment: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_cover_index: 0,
      photo_images: photoUrls,
    },
    post_mode: 'DIRECT_POST',
    media_type: 'PHOTO',
  };

  const res = await fetch(`${BASE}/post/publish/content/init/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error?.code !== 'ok') {
    return { success: false, error: data.error?.message || `TikTok API ${res.status}` };
  }
  return { success: true, publishId: data.data?.publish_id };
}

/** Check publish status. */
async function getTikTokPublishStatus(publishId) {
  if (!process.env.TIKTOK_ACCESS_TOKEN) return notConfigured();
  const res = await fetch(`${BASE}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ publish_id: publishId }),
  });
  const data = await res.json().catch(() => ({}));
  return { success: res.ok, status: data.data?.status, error: data.error?.message };
}

/** Fetch account-level analytics (Business API). */
async function getTikTokAnalytics({ startDate, endDate, metrics } = {}) {
  if (!process.env.TIKTOK_ACCESS_TOKEN || !process.env.TIKTOK_OPEN_ID) return notConfigured();

  const today = new Date();
  const s = startDate || new Date(today - 7 * 86400000).toISOString().slice(0, 10);
  const e = endDate || today.toISOString().slice(0, 10);
  const defaultMetrics = ['follower_count', 'video_views', 'profile_views', 'likes', 'comments', 'shares'];
  const fields = (metrics || defaultMetrics).join(',');

  const params = new URLSearchParams({
    fields: `data(${fields},date),date_range`,
    start_date: s.replace(/-/g, ''),
    end_date: e.replace(/-/g, ''),
    granularity: 'DAY',
    open_id: process.env.TIKTOK_OPEN_ID,
  });

  const res = await fetch(`${BASE}/research/user/info/?${params}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.error?.message || `TikTok ${res.status}` };
  return { success: true, data: data.data };
}

module.exports = { postTikTokVideo, postTikTokPhotos, getTikTokPublishStatus, getTikTokAnalytics };
