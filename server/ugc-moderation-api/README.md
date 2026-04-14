# UGC Moderation API (Apple Guideline 1.2)

Express + MongoDB service for terms acceptance, explicit-content preference, reports, blocks, and text validation.

## Quick start

```bash
cd server/ugc-moderation-api
cp .env.example .env
# Edit .env — set MONGODB_URI and ADMIN_API_KEY
npm install
npm start
```

Base URL: `http://localhost:3840/api/v1`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/terms/accept` | Store EULA acceptance (`userId`, optional `termsVersion`) |
| GET | `/terms/status/:userId` | Check if user has accepted |
| GET | `/users/:userId/settings` | Get `hideExplicit` (default true) |
| PATCH | `/users/:userId/settings` | Body: `{ hideExplicit: boolean }` |
| POST | `/reports` | Submit content report |
| GET | `/reports` | Admin: list reports (`?adminKey=` or `x-admin-key`) |
| PATCH | `/reports/:id` | Admin: update status (`pending` / `reviewed` / `removed`) |
| POST | `/blocks` | Record user block + audit |
| GET | `/blocks/:blockerId` | List blocked user IDs for a user |
| POST | `/moderation/validate-text` | Profanity / severity check before post |

## Auth (integrate with your IdP)

Demo uses headers:

- `x-user-id` — reporter / blocker identity (replace with JWT middleware in production).

Admin routes require `x-admin-key` matching `ADMIN_API_KEY` or query `adminKey`.

## Example requests

```bash
# Accept terms (replace USER)
curl -s -X POST http://localhost:3840/api/v1/terms/accept \
  -H "Content-Type: application/json" -H "x-user-id: USER" \
  -d '{"termsVersion":"1.0"}'

# Submit report
curl -s -X POST http://localhost:3840/api/v1/reports \
  -H "Content-Type: application/json" -H "x-user-id: USER" \
  -d '{"contentId":"song_123","contentType":"song","reason":"spam","details":""}'

# List reports (admin)
curl -s "http://localhost:3840/api/v1/reports?adminKey=YOUR_ADMIN_API_KEY"

# Update report status
curl -s -X PATCH http://localhost:3840/api/v1/reports/REPORT_MONGO_ID \
  -H "Content-Type: application/json" -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -d '{"status":"reviewed","reviewedBy":"admin@example.com"}'
```

## React Native UI

See `rn-ugc-reference/` at repo root for screens and modals that call these endpoints.

## Note for this monorepo

The main Asteroid web app uses **Firebase Realtime Database**, not this Mongo service. You can:

- Point a native client at this API for moderation-only data, or  
- Add **Firebase Cloud Functions** that mirror `POST /reports` and `POST /blocks` into Mongo for a unified moderation queue.
