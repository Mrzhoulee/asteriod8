#!/usr/bin/env node
// Instagram OAuth helper — gets you a long-lived token + your business account ID.
//
//   npm run auth:instagram
//
// This matches the "Instagram API with Instagram Login" flow (graph.instagram.com),
// which is what tools/instagram.js uses — no Facebook Page juggling required, just an
// Instagram Business or Creator account.
//
// What it does:
//   1. Reads INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_REDIRECT_URI from .env
//      (prompts for anything missing).
//   2. Prints an authorize URL — open it, approve, and Instagram redirects you to your
//      redirect URI with a ?code=... in the address bar.
//   3. Paste that whole redirected URL back here.
//   4. It exchanges the code → short-lived token → 60-day long-lived token, then prints:
//        INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ID.
//
// Prereq: create an app at https://developers.facebook.com, add the "Instagram" product,
// set up "Instagram API with Instagram login", and register your redirect URI there.
// See CREDENTIALS.md for the click-by-click.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('node:readline/promises');

const AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const SHORT_TOKEN = 'https://api.instagram.com/oauth/access_token';
const LONG_TOKEN = 'https://graph.instagram.com/access_token';
const SCOPES = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, fallback) => (fallback ? fallback : (await rl.question(q)).trim());

  console.log('\n📸  Instagram auth helper\n');

  const appId = await ask('INSTAGRAM_APP_ID (Instagram app ID, not the Meta app ID): ', process.env.INSTAGRAM_APP_ID);
  const appSecret = await ask('INSTAGRAM_APP_SECRET: ', process.env.INSTAGRAM_APP_SECRET);
  const redirectUri = await ask(
    'Redirect URI (must match what you registered): ',
    process.env.INSTAGRAM_REDIRECT_URI
  );

  if (!appId || !appSecret || !redirectUri) {
    console.error('\n✗ Need app ID, app secret, and redirect URI. Add them to .env or enter them above.');
    rl.close();
    process.exit(1);
  }

  const authUrl = `${AUTHORIZE}?${new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
  })}`;

  console.log('\n① Open this URL in your browser and approve:\n');
  console.log('   ' + authUrl + '\n');
  console.log('② Instagram redirects you to your redirect URI. Copy the FULL URL from the');
  console.log('   address bar (it has ?code=...). The page itself may look broken — fine.\n');

  const pasted = (await rl.question('③ Paste the redirected URL here: ')).trim();
  rl.close();

  let code;
  try {
    code = new URL(pasted).searchParams.get('code');
  } catch {
    code = pasted.includes('=') ? new URLSearchParams(pasted.split('?').pop()).get('code') : pasted;
  }
  if (!code) {
    console.error('\n✗ Could not find a code in that URL. Make sure you copied the whole thing.');
    process.exit(1);
  }
  // Instagram appends #_ to the redirect; strip anything after a #.
  code = decodeURIComponent(code).split('#')[0];

  // Step 1: code → short-lived token (also returns user_id = business account ID)
  console.log('\n… exchanging code for a short-lived token …');
  const shortRes = await fetch(SHORT_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortData = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || !shortData.access_token) {
    console.error('\n✗ Short-token exchange failed:', shortData.error_message || shortData.error_type || shortRes.status);
    process.exit(1);
  }
  const businessId = shortData.user_id || (Array.isArray(shortData.data) && shortData.data[0]?.user_id);

  // Step 2: short-lived → 60-day long-lived token
  console.log('… upgrading to a 60-day long-lived token …');
  const longRes = await fetch(`${LONG_TOKEN}?${new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: appSecret,
    access_token: shortData.access_token,
  })}`);
  const longData = await longRes.json().catch(() => ({}));
  if (!longRes.ok || !longData.access_token) {
    console.error('\n✗ Long-token exchange failed:', longData.error?.message || longRes.status);
    process.exit(1);
  }

  console.log('\n✓ Success! Add these to your .env:\n');
  console.log('INSTAGRAM_APP_ID=' + appId);
  console.log('INSTAGRAM_APP_SECRET=' + appSecret);
  console.log('INSTAGRAM_ACCESS_TOKEN=' + longData.access_token);
  console.log('INSTAGRAM_BUSINESS_ID=' + businessId);
  const days = longData.expires_in ? Math.round(longData.expires_in / 86400) : 60;
  console.log(`\nLong-lived token lasts ~${days} days. Refresh it before it expires with:`);
  console.log('   GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>\n');
}

main().catch((e) => {
  console.error('\n✗ Error:', e.message);
  process.exit(1);
});
