#!/usr/bin/env node
// TikTok OAuth helper — turns the Content Posting API token dance into one command.
//
//   npm run auth:tiktok
//
// What it does:
//   1. Reads TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI from .env
//      (prompts for anything missing).
//   2. Prints an authorize URL — open it, approve, and TikTok redirects you to your
//      redirect URI with a ?code=... in the address bar.
//   3. Paste that whole redirected URL back here.
//   4. It exchanges the code and prints the exact .env lines to copy in:
//        TIKTOK_ACCESS_TOKEN, TIKTOK_OPEN_ID (+ refresh token).
//
// Prereq: create an app at https://developers.tiktok.com, add the "Content Posting
// API" product, and register your redirect URI there (must match exactly, https://).
// See CREDENTIALS.md for the click-by-click.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('node:readline/promises');

const AUTHORIZE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
// Scopes for posting. (Analytics needs the Research API, which TikTok approves separately.)
const SCOPES = 'user.info.basic,video.publish,video.upload';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, fallback) => {
    if (fallback) return fallback;
    const a = (await rl.question(q)).trim();
    return a;
  };

  console.log('\n🎵  TikTok auth helper\n');

  const clientKey = await ask('TIKTOK_CLIENT_KEY: ', process.env.TIKTOK_CLIENT_KEY);
  const clientSecret = await ask('TIKTOK_CLIENT_SECRET: ', process.env.TIKTOK_CLIENT_SECRET);
  const redirectUri = await ask(
    'Redirect URI (must match what you registered in the TikTok app): ',
    process.env.TIKTOK_REDIRECT_URI
  );

  if (!clientKey || !clientSecret || !redirectUri) {
    console.error('\n✗ Need client key, client secret, and redirect URI. Add them to .env or enter them above.');
    rl.close();
    process.exit(1);
  }

  const state = Math.random().toString(36).slice(2);
  const authUrl = `${AUTHORIZE}?${new URLSearchParams({
    client_key: clientKey,
    scope: SCOPES,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })}`;

  console.log('\n① Open this URL in your browser and approve:\n');
  console.log('   ' + authUrl + '\n');
  console.log('② TikTok will redirect you to your redirect URI. The page may look broken —');
  console.log('   that\'s fine. Copy the FULL URL from the address bar (it has ?code=...).\n');

  const pasted = (await rl.question('③ Paste the redirected URL here: ')).trim();
  rl.close();

  let code;
  try {
    code = new URL(pasted).searchParams.get('code');
  } catch {
    // Maybe they pasted just the code
    code = pasted.includes('=') ? new URLSearchParams(pasted.split('?').pop()).get('code') : pasted;
  }
  if (!code) {
    console.error('\n✗ Could not find a code in that URL. Make sure you copied the whole thing.');
    process.exit(1);
  }
  // TikTok URL-encodes the code; decode once.
  code = decodeURIComponent(code);

  console.log('\n… exchanging code for tokens …');
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    console.error('\n✗ Token exchange failed:', data.error_description || data.error || res.status);
    if (data.log_id) console.error('   log_id:', data.log_id);
    process.exit(1);
  }

  console.log('\n✓ Success! Add these to your .env:\n');
  console.log('TIKTOK_CLIENT_KEY=' + clientKey);
  console.log('TIKTOK_CLIENT_SECRET=' + clientSecret);
  console.log('TIKTOK_ACCESS_TOKEN=' + data.access_token);
  console.log('TIKTOK_OPEN_ID=' + data.open_id);
  if (data.refresh_token) console.log('TIKTOK_REFRESH_TOKEN=' + data.refresh_token);
  console.log('\nScopes granted: ' + (data.scope || SCOPES));
  const days = data.expires_in ? Math.round(data.expires_in / 86400) : '?';
  console.log(`Access token expires in ~${days} days. Re-run this when it lapses, or refresh with the refresh token.\n`);
}

main().catch((e) => {
  console.error('\n✗ Error:', e.message);
  process.exit(1);
});
