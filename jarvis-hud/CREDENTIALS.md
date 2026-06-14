# Getting your API credentials

Everything JARVIS connects to lives behind your own logins, so these have to be
created by you. Below is the exact click-path for each, **ordered fastest-first**.
Paste each value into `jarvis-hud/.env` (copy `.env.example` to `.env` first).

> **Tip:** no quotes, no spaces around `=`. `KEY=value`, one per line. A stray
> space (e.g. `KEY= value`) will break the request.

| Service | Time | Difficulty | Helper |
|---------|------|------------|--------|
| [Mailchimp](#1-mailchimp--1-min) | ~1 min | trivial | — |
| [Appfigures](#2-appfigures--2-min) | ~2 min | trivial | — |
| [App Store Connect](#3-app-store-connect--5-min) | ~5 min | easy | — |
| [TikTok](#4-tiktok--15-min) | ~15 min | involved | `npm run auth:tiktok` |
| [Instagram](#5-instagram--15-min) | ~15 min | involved | `npm run auth:instagram` |

---

## 1. Mailchimp — 1 min

1. Log in at <https://mailchimp.com>.
2. Click your **avatar** (bottom-left) → **Account & billing**.
3. **Extras** menu → **API keys**.
4. Click **Create A Key**, name it `jarvis`, copy it.

It looks like `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21`. The `-us21` suffix is your
data center — JARVIS reads it automatically.

```
MAILCHIMP_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21
```

---

## 2. Appfigures — 2 min

1. Log in at <https://appfigures.com>.
2. Top-right account menu → **Account** → **API** (or go straight to
   <https://appfigures.com/account/apis>).
3. Under **Personal Access Tokens**, click **Generate a token**.
4. Copy both the **token** and the **Client Key** shown next to it.

```
APPFIGURES_TOKEN=your-personal-access-token
APPFIGURES_CLIENT_KEY=your-client-key
```

Then ask JARVIS *"check Appfigures sales"* or *"show me recent app reviews"*.

---

## 3. App Store Connect — 5 min

You need the **Account Holder** or **Admin** role. This gives JARVIS sales,
downloads, and reviews for your apps.

**API key (3 values):**

1. Go to <https://appstoreconnect.apple.com/access/integrations/api>
   (**Users and Access → Integrations → App Store Connect API**).
2. Under **Team Keys**, click the **＋**.
3. Name it `jarvis`, set **Access** to **Admin** (needed for sales reports), **Generate**.
4. **Download the `.p8` file now** — Apple lets you download it **once**. Save it
   somewhere stable, e.g. `~/keys/AuthKey_XXXXXXXXXX.p8`.
5. From the same page, copy:
   - **Issuer ID** (UUID at the top of the Keys list)
   - **Key ID** (the 10-character ID in your key's row)

**Vendor number (1 value):**

6. Go to **Business** (formerly *Payments and Financial Reports*) →
   <https://appstoreconnect.apple.com/business>. Your **Vendor #** (8 digits) is
   shown near your legal entity name / top of the page.

```
APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
APP_STORE_CONNECT_PRIVATE_KEY=/Users/you/keys/AuthKey_XXXXXXXXXX.p8
APP_STORE_CONNECT_VENDOR_NUMBER=12345678
```

> The private key can be a **file path** (above) or the PEM pasted **inline**
> (`-----BEGIN PRIVATE KEY-----\n...`). A path is cleaner.

Then ask JARVIS *"show App Store sales last month"* or *"any new App Store reviews?"*.

---

## 4. TikTok — 15 min

TikTok's tokens come from an OAuth flow. The `npm run auth:tiktok` helper does the
token exchange for you — you just set up the app and approve once.

**Set up the app:**

1. Go to <https://developers.tiktok.com>, log in, **Manage apps → Connect an app**.
2. Open your app → **Add products** → add **Content Posting API** (and
   **Login Kit** if it isn't already there).
3. Under **Content Posting API**, enable **Direct Post**.
4. In the app's **Login Kit / URL settings**, add a **Redirect URI**. It must be
   `https://` (TikTok rejects `http://`). If you don't have a site, any https URL
   you control works — even `https://localhost/` is accepted by many setups; the
   page doesn't need to load, you just copy the `?code=` it redirects to.
5. Copy the **Client key** and **Client secret** from the app's credentials page.

> **Sandbox vs. audited:** until your app passes TikTok's audit, posts are
> restricted to your own account as **private / SELF_ONLY**. Add yourself as a
> **Target User** in the sandbox to test. Submit for review to post publicly.

**Get your tokens — one command:**

```bash
cd jarvis-hud
npm run auth:tiktok
```

It asks for your client key, secret, and redirect URI (or reads them from
`.env`), prints an authorize URL, and after you paste back the redirected URL it
prints your `TIKTOK_ACCESS_TOKEN` and `TIKTOK_OPEN_ID`. Paste those into `.env`:

```
TIKTOK_CLIENT_KEY=awxxxxxxxxxxxxx
TIKTOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
TIKTOK_REDIRECT_URI=https://localhost/
TIKTOK_ACCESS_TOKEN=act.xxxxxxxx
TIKTOK_OPEN_ID=-xxxxxxxx
```

---

## 5. Instagram — 15 min

Needs an Instagram **Business** or **Creator** account. The `npm run auth:instagram`
helper handles the short→long-lived token exchange and finds your account ID.

**Set up the app:**

1. Make sure your IG account is **Business** or **Creator** (Instagram app →
   Settings → *Account type and tools*).
2. Go to <https://developers.facebook.com/apps> → **Create app** → use case
   **Other** → type **Business**.
3. In the app, **Add product → Instagram → Set up**, then choose
   **API setup with Instagram login**.
4. Under **Business login settings**, add an **OAuth redirect URI** (e.g.
   `https://localhost/`).
5. Note the **Instagram app ID** and **Instagram app secret** shown on that page
   (these are the *Instagram* ones, not the top-level Meta app ID/secret).

**Get your token — one command:**

```bash
cd jarvis-hud
npm run auth:instagram
```

It prints an authorize URL; approve it, paste back the redirected URL, and it
outputs your `INSTAGRAM_ACCESS_TOKEN` (60-day) and `INSTAGRAM_BUSINESS_ID`:

```
INSTAGRAM_APP_ID=1234567890
INSTAGRAM_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
INSTAGRAM_REDIRECT_URI=https://localhost/
INSTAGRAM_ACCESS_TOKEN=IGAAxxxxxxxx
INSTAGRAM_BUSINESS_ID=17841xxxxxxxxxxxx
```

> The long-lived token lasts ~60 days. Refresh it before then:
> `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>`

---

## After you add credentials

1. Save `.env`.
2. Restart the app (`npm start`) so it picks up the new values.
3. Ask JARVIS to use them, e.g.:
   - *"What are my Mailchimp audience stats?"*
   - *"Show App Store downloads for last month."*
   - *"Post this photo to Instagram: <url> — caption: …"*

If something's misconfigured, JARVIS tells you exactly which variable is missing
rather than failing silently.
