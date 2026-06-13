// Appfigures API v2 — cross-store app analytics (sales, downloads, reviews,
// ratings, ranks) across the App Store and Google Play in one place.
//
// Setup:
//   APPFIGURES_TOKEN=...        Personal Access Token (Appfigures → Account → API)
//   APPFIGURES_CLIENT_KEY=...   Client key shown alongside the token
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE = 'https://api.appfigures.com/v2';

function headers() {
  const h = { Authorization: `Bearer ${process.env.APPFIGURES_TOKEN}` };
  if (process.env.APPFIGURES_CLIENT_KEY) h['X-Client-Key'] = process.env.APPFIGURES_CLIENT_KEY;
  return h;
}

async function afGet(path, params = {}) {
  if (!process.env.APPFIGURES_TOKEN) {
    return { success: false, error: 'Appfigures not configured. Set APPFIGURES_TOKEN and APPFIGURES_CLIENT_KEY in .env.' };
  }
  const q = new URLSearchParams(params);
  const url = `${BASE}${path}${q.toString() ? `?${q}` : ''}`;
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.message) || (typeof data === 'string' ? data.slice(0, 200) : `Appfigures ${res.status}`);
    return { success: false, error: msg };
  }
  return { success: true, data };
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end - 30 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Sales & downloads report. */
async function fetchSales({ startDate, endDate, groupBy = 'product' } = {}) {
  const { start, end } = defaultRange();
  const r = await afGet('/reports/sales', {
    start_date: startDate || start,
    end_date: endDate || end,
    group_by: groupBy,          // product | date | country | store
    granularity: 'daily',
  });
  if (!r.success) return r;

  // Summarize when grouped by product
  const summary = [];
  if (r.data && typeof r.data === 'object') {
    for (const [key, val] of Object.entries(r.data)) {
      if (val && typeof val === 'object') {
        summary.push({
          group: key,
          downloads: val.downloads,
          updates: val.updates,
          revenue: val.revenue,
          netRevenue: val.net_revenue,
        });
      }
    }
  }
  return { success: true, dateRange: { startDate: startDate || start, endDate: endDate || end }, summary: summary.length ? summary : r.data };
}

/** Recent reviews across stores. */
async function fetchReviews({ count = 25, lang } = {}) {
  const r = await afGet('/reviews', { count, page: 1, ...(lang ? { lang } : {}), sort: 'date' });
  if (!r.success) return r;
  const reviews = (r.data?.reviews || []).map((rv) => ({
    store: rv.store,
    stars: rv.stars,
    title: rv.title,
    review: (rv.review || '').slice(0, 300),
    author: rv.author,
    date: rv.date,
    product: rv.product_name,
  }));
  return { success: true, total: r.data?.total, reviews };
}

/** Ratings breakdown. */
async function fetchRatings() {
  return afGet('/ratings');
}

/** Your tracked products (apps), to get product IDs. */
async function fetchProducts() {
  const r = await afGet('/products/mine');
  if (!r.success) return r;
  const products = Object.values(r.data || {}).map((p) => ({
    id: p.id,
    name: p.name,
    developer: p.developer,
    store: p.store,
  }));
  return { success: true, products };
}

module.exports = { fetchSales, fetchReviews, fetchRatings, fetchProducts };
