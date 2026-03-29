# Setting Environment Variables for Firebase Functions

## ⚠️ Migration from functions.config()

Firebase is deprecating `functions.config()` in March 2026. We've updated the code to use environment variables instead.

## 🔐 Method 1: Firebase Secrets (Recommended for Production)

Firebase Secrets is the recommended way to store sensitive data:

```bash
# Set secrets (these are encrypted and secure)
firebase functions:secrets:set ENCRYPTION_KEY
firebase functions:secrets:set INSTAGRAM_CLIENT_ID
firebase functions:secrets:set INSTAGRAM_CLIENT_SECRET
firebase functions:secrets:set YOUTUBE_CLIENT_ID
firebase functions:secrets:set YOUTUBE_CLIENT_SECRET
firebase functions:secrets:set APP_BASE_URL

# Deploy with secrets
firebase deploy --only functions
```

## 📝 Method 2: Environment Variables in firebase.json

You can also set environment variables in `firebase.json`:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs18",
    "env": {
      "ENCRYPTION_KEY": "your_key_here",
      "APP_BASE_URL": "https://asteroid8.net",
      "INSTAGRAM_CLIENT_ID": "your_id",
      "INSTAGRAM_CLIENT_SECRET": "your_secret",
      "YOUTUBE_CLIENT_ID": "your_id",
      "YOUTUBE_CLIENT_SECRET": "your_secret"
    }
  }
}
```

## 🏠 Method 3: .env File (Local Development Only)

For local development, create a `.env` file in the `functions/` directory:

```bash
cd functions
cp .env.example .env
# Edit .env with your values
```

**⚠️ Important:** Never commit `.env` to git! It's already in `.gitignore`.

## 📋 Required Environment Variables

- `ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32`
- `APP_BASE_URL` - `https://asteroid8.net` (production) or `http://localhost:5000` (dev)
- `INSTAGRAM_CLIENT_ID` - From Instagram Developer Portal
- `INSTAGRAM_CLIENT_SECRET` - From Instagram Developer Portal
- `YOUTUBE_CLIENT_ID` - From Google Cloud Console
- `YOUTUBE_CLIENT_SECRET` - From Google Cloud Console

## 🚀 Quick Setup

1. Generate encryption key:
   ```bash
   openssl rand -hex 32
   ```

2. Set secrets:
   ```bash
   firebase functions:secrets:set ENCRYPTION_KEY
   # Paste the generated key when prompted
   
   firebase functions:secrets:set APP_BASE_URL
   # Enter: https://asteroid8.net
   ```

3. Deploy:
   ```bash
   firebase deploy --only functions
   ```

## ✅ Verify Configuration

After deployment, check the function logs:
```bash
firebase functions:log
```

If you see "not configured" errors, the environment variables aren't set correctly.

