# Social Media OAuth Integration - Firebase Cloud Functions

## 🔐 Security Architecture

This system implements secure OAuth 2.0 integration for social media platforms:

- **Server-side only**: All OAuth token exchanges happen in Cloud Functions
- **Encrypted storage**: Access tokens are encrypted using AES-256-GCM before storing
- **Token refresh**: Automatic token refresh for platforms that support it
- **Secure callbacks**: State parameter validation prevents CSRF attacks

## 📁 Database Structure

```
artists/
  {userId}/
    socialAccounts/
      instagram/
        accessToken: {encrypted}
        userId: string
        stats/
          followers: number
          weeklyGrowth: number
          totalViews: number
          lastUpdated: timestamp
        connectedAt: timestamp
      youtube/
        accessToken: {encrypted}
        refreshToken: {encrypted}
        expiresAt: timestamp
        channelId: string
        stats/...
      tiktok/...
      spotify/...
      soundcloud/...
    aggregatedStats/
      totalFollowers: number
      totalViews: number
      weeklyGrowth: number
      engagementRate: number
      platforms/
        instagram/...
        youtube/...
      lastUpdated: timestamp
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Firebase Functions

```bash
# Set encryption key
firebase functions:config:set encryption.key="$(openssl rand -hex 32)"

# Set Instagram credentials
firebase functions:config:set instagram.client_id="YOUR_CLIENT_ID"
firebase functions:config:set instagram.client_secret="YOUR_CLIENT_SECRET"

# Set YouTube credentials
firebase functions:config:set youtube.client_id="YOUR_CLIENT_ID"
firebase functions:config:set youtube.client_secret="YOUR_CLIENT_SECRET"

# Repeat for other platforms...
```

### 3. Deploy Functions

```bash
firebase deploy --only functions
```

## 🔗 OAuth Callback URLs

Configure these redirect URIs in each platform's OAuth app settings:

- Instagram: `https://asteroid8.com/oauth/callback?platform=instagram`
- YouTube: `https://asteroid8.com/oauth/callback?platform=youtube`
- TikTok: `https://asteroid8.com/oauth/callback?platform=tiktok`
- Spotify: `https://asteroid8.com/oauth/callback?platform=spotify`
- SoundCloud: `https://asteroid8.com/oauth/callback?platform=soundcloud`

## 📊 Scheduled Updates

The `dailyAnalyticsUpdater` function runs every 24 hours to:
- Refresh stats from all connected platforms
- Update aggregated statistics
- Calculate growth metrics

## 🔧 Adding New Platforms

To add a new platform:

1. Create `connect{Platform}` function (initiates OAuth)
2. Create `{platform}Callback` function (handles OAuth callback)
3. Create `fetch{Platform}Stats` function (fetches analytics)
4. Add to `dailyAnalyticsUpdater` function
5. Update frontend `SOCIAL_PLATFORMS` configuration

## ⚠️ Important Notes

- Never expose access tokens in frontend code
- Always validate user authentication in Cloud Functions
- Use HTTPS for all OAuth redirects
- Implement proper error handling and logging
- Monitor function execution logs for issues

