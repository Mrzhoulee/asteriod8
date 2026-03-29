# Cloud Functions Deployment Instructions

## ⚠️ Important: Deploy Functions First

The "Page not found" error occurs because Cloud Functions haven't been deployed yet. Follow these steps:

## 🚀 Quick Deployment Steps

### 1. Navigate to Functions Directory

```bash
cd functions
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Configuration

```bash
# Generate encryption key
openssl rand -hex 32

# Set encryption key (replace with your generated key)
firebase functions:config:set encryption.key="YOUR_GENERATED_KEY_HERE"

# Set base URL (use asteroid8.net for production, localhost for dev)
firebase functions:config:set app.base_url="https://asteroid8.net"
# For local development:
# firebase functions:config:set app.base_url="http://localhost:5000"

# Set Instagram credentials (get from Instagram Developer Portal)
firebase functions:config:set instagram.client_id="YOUR_INSTAGRAM_CLIENT_ID"
firebase functions:config:set instagram.client_secret="YOUR_INSTAGRAM_CLIENT_SECRET"

# Set YouTube credentials (get from Google Cloud Console)
firebase functions:config:set youtube.client_id="YOUR_YOUTUBE_CLIENT_ID"
firebase functions:config:set youtube.client_secret="YOUR_YOUTUBE_CLIENT_SECRET"

# Repeat for other platforms as needed
```

### 4. Deploy Functions

```bash
firebase deploy --only functions
```

This will deploy all Cloud Functions. The deployment will show you the function URLs.

### 5. Verify Deployment

After deployment, you should see output like:
```
✔  functions[connectInstagram(us-central1)] Successful create operation.
✔  functions[connectYouTube(us-central1)] Successful create operation.
...
```

## 🔗 Function URLs

After deployment, your functions will be available at:
- `https://us-central1-asteroid-cdc13.cloudfunctions.net/connectInstagram`
- `https://us-central1-asteroid-cdc13.cloudfunctions.net/connectYouTube`
- etc.

## 📝 OAuth App Setup

### Instagram
1. Go to https://developers.facebook.com/
2. Create an app → Instagram Basic Display
3. Add redirect URIs:
   - Production: `https://asteroid8.net/oauth/callback?platform=instagram`
   - Development: `http://localhost:5000/oauth/callback?platform=instagram`
4. Get Client ID and Client Secret

### YouTube
1. Go to https://console.cloud.google.com/
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Add redirect URIs:
   - Production: `https://asteroid8.net/oauth/callback?platform=youtube`
   - Development: `http://localhost:5000/oauth/callback?platform=youtube`
5. Get Client ID and Client Secret

### Other Platforms
Follow similar steps for TikTok, Spotify, and SoundCloud.

## 🧪 Testing

After deployment:
1. Go to Artist Dashboard
2. Click "Social Accounts" tab
3. Click "Connect" on any platform
4. You should be redirected to the platform's OAuth page

## ⚠️ Troubleshooting

**"Page not found" error:**
- Functions aren't deployed → Run `firebase deploy --only functions`
- Wrong project ID → Check `firebaseConfig.projectId` matches your project

**"Function not found" error:**
- Function name mismatch → Check function names in `functions/index.js`
- Region mismatch → Ensure region in URL matches deployment region

**OAuth redirect fails:**
- Redirect URI mismatch → Must match exactly in OAuth app settings
- CORS issues → Cloud Functions handle this automatically

## 📚 Next Steps

1. Deploy functions using steps above
2. Configure OAuth apps for each platform
3. Test connection flow
4. Monitor Cloud Functions logs: `firebase functions:log`

