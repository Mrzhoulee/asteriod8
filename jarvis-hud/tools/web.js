// Generic authenticated HTTP — the "check analytics / talk to any web API" tool.
// Auth profiles live in .env as WEB_AUTH_<PROFILE> and are injected as an
// Authorization header, so the agent never sees raw secrets. Example:
//   WEB_AUTH_STRIPE=Bearer sk_live_xxx
//   WEB_AUTH_GA=Bearer ya29.xxx
// Then call web_request with authProfile:"stripe".
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MAX_BODY = 12000; // chars returned to the model

async function webRequest({ method = 'GET', url, headers = {}, body, authProfile }) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { success: false, error: 'A valid http(s) URL is required.' };
  }

  const finalHeaders = { ...headers };
  if (authProfile) {
    const secret = process.env[`WEB_AUTH_${authProfile.toUpperCase()}`];
    if (!secret) {
      return {
        success: false,
        error: `No auth profile "WEB_AUTH_${authProfile.toUpperCase()}" in .env.`,
      };
    }
    finalHeaders['Authorization'] = secret;
  }

  let payload;
  if (body != null && method.toUpperCase() !== 'GET') {
    if (typeof body === 'object') {
      payload = JSON.stringify(body);
      if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
    } else {
      payload = String(body);
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: finalHeaders,
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    const truncated = text.length > MAX_BODY;
    return {
      success: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      body: parsed != null ? parsed : text.slice(0, MAX_BODY),
      truncated,
    };
  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Request timed out (30s).' : err.message };
  }
}

module.exports = { webRequest };
