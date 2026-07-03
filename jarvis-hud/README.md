# JARVIS HUD

An always-on-top, Claude-powered multi-agent assistant for macOS. JARVIS is your
chief of staff: it delegates to specialists, controls your Mac, posts to social,
schedules calls, checks analytics, and talks to any web API — all from a dark HUD
overlay that lives on your dock and in your menu bar.

## Agents

| Agent  | Role             | Accent |
|--------|------------------|--------|
| JARVIS | Center brain / orchestrator (has all the tools) | cyan |
| Hannah | Marketing & copywriting | pink |
| Marcus | Development & debugging | green |
| Rob    | Customer success & comms | amber |

These are just the defaults. Open **Customize (⌘,) → "AI model & team"** to rename
any teammate, change their role, or rewrite their job (system prompt) — and to pick
the Claude model that powers everyone (Opus 4.8 / Sonnet 4.6 / Haiku 4.5). Changes
save to `personas.json` and apply to your next message; "Reset" restores a default.

## What JARVIS can do

- **Your computer** — `run_command` runs any shell command; `run_applescript`
  drives any Mac app (Messages, Mail, Calendar, Music, Finder, Safari/Chrome,
  System Events UI automation); `control_mac` does quick actions (screenshot,
  notify, open app, set volume, clipboard).
- **Communications** — `send_email` (with attachments), `open_url`.
- **Social** — `post_social` to X, LinkedIn, Facebook, Threads, Reddit, etc.
- **Scheduling** — `schedule_event` adds calls to Calendar and generates `.ics`
  invites you can email to attendees.
- **The web / analytics** — `web_request` calls any REST API with a configured
  secret (Stripe, Google Analytics, GitHub, …).
- **Files** — `read_file`, `write_file`, `list_directory`.
- **Delegation** — hands specialist work to Hannah, Marcus, or Rob.

## The Growth Suite — built to get Asteroid to 1,000 users

Three founder hubs live next to the chat (every feature can hand its work
straight to JARVIS and the team):

**➚ Growth Hub (⌘5, `/growth`)**
- 🎯 **Mission** — north-star tracker to 1,000 users with source attribution,
  milestone celebrations (confetti at 10 → 1K), founder XP/levels, and one-click
  "what should I do next?" powered by your real analytics. Backup/import all data.
- ☑ **Daily** — recurring growth checklist (post, engage, DM curators…) with
  day-streak tracking; every task has a ▶ button that makes JARVIS do it.
- 📅 **Content** — content calendar per platform with idea→drafted→scheduled→posted
  statuses, "draft with Hannah" and "post via JARVIS" on every row.
- 🤝 **Outreach** — mini-CRM for playlist curators / influencers / press with
  pipeline statuses, follow-up dates, due-today banner, and Hannah-drafted pitches.
- ⚗ **Experiments** — growth-bet backlog ranked by ICE score with JARVIS planning.
- 💬 **Feedback** — user feedback inbox with tags + upvotes, and a testimonial
  vault (star praise → copy-ready social proof).
- 🔭 **Rivals** — competitor watchlist with one-click JARVIS deep-dives.
- 🚀 **Launch** — App Store / Product Hunt / press / community launch checklist
  with overall readiness meter.

**⚒ Startup Toolkit (⌘6, `/toolkit`)**
- ▶ **Playbooks** — one-click multi-tool JARVIS plays (morning briefing `/brief`,
  evening wrap-up, 10 TikTok hooks, curator pitch sprint, ASO tune-up, review
  reply sweep, weekly growth report, launch thread) + your own saved playbooks.
- ✉ **Templates** — outreach email library (curator pitch, influencer collab,
  press pitch, beta invite, win-back) with live `{{variable}}` fill, copy, and
  send-via-JARVIS.
- # **Hashtags** — music-niche hashtag bank per platform, one-click copy.
- 🔗 **UTM Links** — trackable link builder with history (see which channel
  actually converts in GA4).
- 🕐 **Best Times** — when to post per platform.
- 💰 **Revenue** — conversion → MRR/ARR calculator, incl. "at 1,000 users".
- 📰 **Press Kit** — one-pager generator (markdown, copy/download, polish with
  Hannah).

**◉ Focus Mode (⌘7, `/focus`)**
- Pomodoro timer (25/50 min) with a live mini-badge in the title bar, spoken
  alerts, and per-day session counts.
- Today's Top-3 goals with daily rollover + yesterday's score.
- Persistent scratchpad with markdown export.

All growth data persists locally (and exports to JSON from the Mission tab).

## Safety model — "do anything", with a human in the loop

The agent reads untrusted content (emails, web pages), so destructive actions are
gated rather than blindly executed:

- **Safe** commands run automatically.
- **Dangerous** ones (`rm`, `sudo`, `chmod`, `git push`, file writes, system
  AppleScripts, sending email) pop a **confirmation dialog** showing the exact
  action — you approve before anything happens.
- **Catastrophic** ones (`rm -rf /`, disk formatting, fork bombs, force-push) show
  a stern warning that defaults to *Cancel*.

Nothing is impossible, but you always see destructive actions before they run —
which also defeats prompt-injection. Tell JARVIS "just send it" / include "just
send it" to skip confirmation for a turn.

## Setup

```bash
cd jarvis-hud
cp .env.example .env     # add your keys (see below)
npm install
npm start
```

### Required keys (`.env`)

- `ANTHROPIC_API_KEY` — powers every agent (default model: `claude-opus-4-8`;
  switch it live in Customize → "AI model & team", or set `JARVIS_MODEL`)
- `GROQ_API_KEY` — voice input (Whisper)
- Email: `GMAIL_USER` + `GMAIL_PASS` (app password) **or** `SMTP_*`

### Optional

- `SOCIAL_WEBHOOK_URL` — a Zapier/Make/Buffer hook for one-call multi-platform
  posting (otherwise JARVIS opens a pre-filled compose window).
- `X_BEARER_TOKEN` — direct posting to X.
- `WEB_AUTH_<NAME>` — Authorization header values for `web_request`
  (e.g. `WEB_AUTH_STRIPE=Bearer sk_live_…`), referenced by name so the model
  never sees the raw secret.

## Build a real dock app (`.app` / `.dmg`)

```bash
npm run icon     # generates build/icon.png + build/icon.icns (macOS)
npm run dist     # builds dist/JARVIS-*.dmg and a .app via electron-builder
```

Open the `.dmg`, drag **JARVIS** to `/Applications`, and launch it — it'll appear
on your dock and in the menu bar. For a packaged app, put your `.env` in the
app's data dir: `~/Library/Application Support/JARVIS/.env`.

> macOS will ask for **Accessibility**, **Automation**, **Screen Recording**, and
> **Microphone** permissions the first time JARVIS uses them — grant them in
> System Settings → Privacy & Security.

## Usage

- Type or hold 🎤 to talk. `Enter` sends.
- **⌘⇧J** toggles the HUD anywhere. The menu-bar icon does too.
- 🔊 toggles spoken replies (macOS `say`).
- Memory persists the last 20 exchanges (`memory/context.json` in dev, app data
  dir when packaged); the last 10 are passed back to Claude as context.

## Layout

```
jarvis-hud/
├── main.js                 # Electron main: window, tray, shortcuts, tool dispatch + confirmations
├── preload.js              # contextBridge API
├── agents/
│   ├── index.js            # streaming runJarvis() agentic loop + runSubAgent()
│   ├── personas.js         # default roster + editable name/role/job + model store
│   └── tools.js            # Claude tool schemas (the 12-tool surface)
├── tools/
│   ├── shell.js            # tiered command classifier + executor
│   ├── mac.js              # AppleScript, screenshot, clipboard, notify, volume
│   ├── email.js            # Nodemailer (Gmail/SMTP) + attachments
│   ├── social.js           # webhook / API / browser-compose posting
│   ├── calendar.js         # Calendar.app event + .ics invite
│   ├── web.js              # authenticated HTTP for analytics/any API
│   ├── files.js            # read/write/list
│   └── memory.js           # JSON memory (writable data dir aware)
├── renderer/               # index.html · styles.css · app.js
├── scripts/                # gen-icon.js (PNG encoder) · make-icns.sh
└── build/                  # generated icon.png / icon.icns
```
