// Google Analytics (GA4) + App Store Connect analytics fetching.
//
// GA4 Auth — two options (pick one):
//   Option A: GOOGLE_ANALYTICS_TOKEN=ya29.xxx  (OAuth2 bearer, ~1hr expiry)
//   Option B: GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/sa.json  (auto-refreshes)
//
// App Store Connect Auth — three vars:
//   APP_STORE_CONNECT_ISSUER_ID=xxxxx-xxxx-xxxx-xxxx
//   APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
//   APP_STORE_CONNECT_PRIVATE_KEY=/path/to/AuthKey_XXXXXXXXXX.p8  (or paste inline)
//   APP_STORE_CONNECT_VENDOR_NUMBER=12345678  (Settings → Payments & Financial Reports)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── GA4 ──────────────────────────────────────────────────────────────────────

async function getGA4Token() {
  // Option A: simple bearer token
  if (process.env.GOOGLE_ANALYTICS_TOKEN) {
    return process.env.GOOGLE_ANALYTICS_TOKEN;
  }
  // Option B: service account JSON → JWT → access token exchange
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.startsWith('/')
      ? process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      : path.join(process.env.JARVIS_DATA_DIR || __dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const toSign = `${header}.${claim}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(toSign);
    const sig = sign.sign(sa.private_key, 'base64url');
    const jwt = `${toSign}.${sig}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(`SA auth failed: ${data.error_description || JSON.stringify(data)}`);
    return data.access_token;
  }
  return null;
}

/**
 * Run a GA4 report.
 * @param {object} opts
 * @param {string} opts.propertyId  GA4 property ID (numbers only, e.g. "123456789")
 * @param {string} [opts.startDate] e.g. "7daysAgo", "30daysAgo", "2026-01-01"
 * @param {string} [opts.endDate]   e.g. "today"
 * @param {string[]} [opts.metrics] GA4 metric names; defaults to common set
 * @param {string[]} [opts.dimensions]
 */
async function fetchGA4Report({ propertyId, startDate = '7daysAgo', endDate = 'today', metrics, dimensions }) {
  const token = await getGA4Token();
  if (!token) {
    return { success: false, error: 'GA4 not configured. Set GOOGLE_ANALYTICS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_ANALYTICS_PROPERTY_ID.' };
  }

  const pid = propertyId || process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  if (!pid) return { success: false, error: 'Set GOOGLE_ANALYTICS_PROPERTY_ID in .env.' };

  const body = {
    dateRanges: [{ startDate, endDate }],
    metrics: (metrics || ['activeUsers', 'sessions', 'screenPageViews', 'newUsers', 'bounceRate']).map((name) => ({ name })),
    dimensions: (dimensions || ['date']).map((name) => ({ name })),
  };

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.status === 401) {
    return { success: false, error: 'GA4 access token expired or invalid. OAuth Playground tokens last ~1 hour — get a fresh one, or switch to GOOGLE_SERVICE_ACCOUNT_JSON for auto-refresh.' };
  }
  if (!res.ok) return { success: false, error: data.error?.message || `GA4 API ${res.status}` };

  // Flatten into readable rows
  const headers = [
    ...(data.dimensionHeaders || []).map((h) => h.name),
    ...(data.metricHeaders || []).map((h) => h.name),
  ];
  const rows = (data.rows || []).map((row) => {
    const values = [
      ...(row.dimensionValues || []).map((v) => v.value),
      ...(row.metricValues || []).map((v) => v.value),
    ];
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });

  return { success: true, dateRange: { startDate, endDate }, propertyId: pid, rows, totals: data.totals };
}

// ── App Store Connect JWT ─────────────────────────────────────────────────────

function makeASCJWT() {
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const keyId    = process.env.APP_STORE_CONNECT_KEY_ID;
  const keyRaw   = process.env.APP_STORE_CONNECT_PRIVATE_KEY;

  if (!issuerId || !keyId || !keyRaw) return null;

  // Support path or inline PEM
  let privateKey;
  if (keyRaw.includes('-----')) {
    privateKey = keyRaw.replace(/\\n/g, '\n');
  } else {
    const p = keyRaw.startsWith('/') ? keyRaw : path.join(process.env.JARVIS_DATA_DIR || __dirname, '..', keyRaw);
    privateKey = fs.readFileSync(p, 'utf8');
  }

  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');

  const toSign = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(toSign);
  const sig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url');
  return `${toSign}.${sig}`;
}

async function ascGet(endpoint) {
  const jwt = makeASCJWT();
  if (!jwt) return { success: false, error: 'App Store Connect not configured. Set APP_STORE_CONNECT_ISSUER_ID, _KEY_ID, _PRIVATE_KEY in .env.' };

  const url = endpoint.startsWith('http') ? endpoint : `https://api.appstoreconnect.apple.com${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (res.status === 204) return { success: true, data: null };
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || res.statusText;
    return { success: false, error: `App Store Connect ${res.status}: ${msg}` };
  }
  return { success: true, data };
}

/**
 * Fetch App Store sales/download summary.
 * @param {object} opts
 * @param {string} [opts.frequency]   DAILY | WEEKLY | MONTHLY  (default MONTHLY)
 * @param {string} [opts.reportDate]  YYYY-MM or YYYY-MM-DD (default: last month)
 * @param {string} [opts.vendorNumber]
 */
async function fetchAppStoreSales({ frequency = 'MONTHLY', reportDate, vendorNumber } = {}) {
  const vendor = vendorNumber || process.env.APP_STORE_CONNECT_VENDOR_NUMBER;
  if (!vendor) return { success: false, error: 'Set APP_STORE_CONNECT_VENDOR_NUMBER in .env (find it in App Store Connect → Payments & Financial Reports → My Vendors).' };

  const now = new Date();
  let defaultDate;
  if (frequency === 'DAILY') {
    defaultDate = new Date(now - 86400000).toISOString().slice(0, 10); // yesterday
  } else {
    // Last month, with correct year rollover (getMonth() is 0-indexed, so
    // getMonth()-1 with a Date handles January → previous December).
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    defaultDate = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;
  }

  const params = new URLSearchParams({
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[frequency]': frequency,
    'filter[vendorNumber]': vendor,
    'filter[reportDate]': reportDate || defaultDate,
  });

  const jwt = makeASCJWT();
  if (!jwt) return { success: false, error: 'App Store Connect not configured.' };

  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!res.ok) {
    const text = await res.text();
    try { const d = JSON.parse(text); return { success: false, error: d?.errors?.[0]?.detail || text.slice(0, 200) }; }
    catch { return { success: false, error: text.slice(0, 200) }; }
  }

  // Reports come back as gzip TSV — decompress and parse
  const buf = Buffer.from(await res.arrayBuffer());
  const zlib = require('zlib');
  let tsv;
  try {
    tsv = zlib.gunzipSync(buf).toString('utf8');
  } catch {
    tsv = buf.toString('utf8');
  }
  const lines = tsv.trim().split('\n');
  const headers = lines[0].split('\t');
  const rows = lines.slice(1).map((line) =>
    Object.fromEntries(line.split('\t').map((v, i) => [headers[i], v]))
  );
  return { success: true, frequency, reportDate: reportDate || defaultDate, rows: rows.slice(0, 50), rowCount: rows.length };
}

/** Fetch app list to get App IDs. */
async function fetchAppStoreApps() {
  return ascGet('/v1/apps?limit=25&fields[apps]=name,bundleId,sku');
}

/** Fetch recent reviews for an app. */
async function fetchAppStoreReviews({ appId, limit = 10 }) {
  if (!appId) return { success: false, error: 'appId required. Run fetchAppStoreApps() first to find your app IDs.' };
  return ascGet(`/v1/apps/${appId}/customerReviews?sort=-createdDate&limit=${limit}`);
}

module.exports = { fetchGA4Report, fetchAppStoreSales, fetchAppStoreApps, fetchAppStoreReviews };
