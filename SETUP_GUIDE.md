# Social Media OAuth Integration - Setup Guide

## 🎯 Overview

This system provides secure OAuth 2.0 integration for social media platforms (Instagram, YouTube, TikTok, Spotify, SoundCloud) with unified analytics dashboard.

## 📋 Prerequisites

1. Firebase project with:
   - Authentication enabled
   - Realtime Database enabled
   - Cloud Functions enabled
   - Billing enabled (for scheduled functions)

2. OAuth apps created for each platform:
   - Instagram Basic Display API
   - YouTube Data API v3
   - TikTok for Developers
   - Spotify for Developers
   - SoundCloud API

## 🚀 Setup Steps

### 1. Install Cloud Functions Dependencies

```bash
cd functions
npm install
```

### 2. Configure Firebase Functions

Set your OAuth credentials and encryption key:

```bash
# Generate encryption key (32 bytes hex)
openssl rand -hex 32

# Set encryption key
firebase functions:config:set encryption.key="YOUR_GENERATED_KEY"

# Set Instagram credentials
firebase functions:config:set instagram.client_id="YOUR_INSTAGRAM_CLIENT_ID"
firebase functions:config:set instagram.client_secret="YOUR_INSTAGRAM_CLIENT_SECRET"

# Set YouTube credentials
firebase functions:config:set youtube.client_id="YOUR_YOUTUBE_CLIENT_ID"
firebase functions:config:set youtube.client_secret="YOUR_YOUTUBE_CLIENT_SECRET"

# Set TikTok credentials
firebase functions:config:set tiktok.client_key="YOUR_TIKTOK_CLIENT_KEY"
firebase functions:config:set tiktok.client_secret="YOUR_TIKTOK_CLIENT_SECRET"

# Set Spotify credentials
firebase functions:config:set spotify.client_id="YOUR_SPOTIFY_CLIENT_ID"
firebase functions:config:set spotify.client_secret="YOUR_SPOTIFY_CLIENT_SECRET"

# Set SoundCloud credentials
firebase functions:config:set soundcloud.client_id="YOUR_SOUNDCLOUD_CLIENT_ID"
firebase functions:config:set soundcloud.client_secret="YOUR_SOUNDCLOUD_CLIENT_SECRET"
```

### 3. Configure OAuth Redirect URIs

In each platform's OAuth app settings, add these redirect URIs:

- **Instagram**: `https://asteroid8.com/oauth/callback?platform=instagram`
- **YouTube**: `https://asteroid8.com/oauth/callback?platform=youtube`
- **TikTok**: `https://asteroid8.com/oauth/callback?platform=tiktok`
- **Spotify**: `https://asteroid8.com/oauth/callback?platform=spotify`
- **SoundCloud**: `https://asteroid8.com/oauth/callback?platform=soundcloud`

### 4. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

### 5. Set Up OAuth Callback Handler

Create a simple HTML page at `/oauth/callback.html` that:
- Receives OAuth callback with `code` and `state` parameters
- Calls the appropriate Cloud Function callback endpoint
- Redirects back to Artist Dashboard

### 6. Database Structure

The system uses Firebase Realtime Database with this structure:

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

## 🔐 Security Features

1. **Encrypted Token Storage**: All access tokens are encrypted using AES-256-GCM
2. **Server-Side Only**: OAuth exchanges happen only in Cloud Functions
3. **State Validation**: CSRF protection via state parameter
4. **Token Refresh**: Automatic refresh for platforms that support it
5. **Authentication Required**: All functions require Firebase Auth

## 📊 Analytics Features

- **Unified Dashboard**: Combined metrics from all platforms
- **Daily Updates**: Scheduled function updates stats every 24 hours
- **Real-Time Refresh**: Manual refresh button for immediate updates
- **Growth Tracking**: Weekly growth calculations
- **Engagement Metrics**: Calculated engagement rates

## 🧪 Testing

1. Test OAuth flow for each platform
2. Verify token encryption/decryption
3. Test token refresh for YouTube
4. Verify daily scheduled updates
5. Test disconnect functionality

## 📝 Notes

- Tokens are never exposed to frontend
- All API calls go through Cloud Functions
- Analytics are cached to minimize API usage
- Platform-specific APIs may have rate limits

## 🔧 Troubleshooting

- **OAuth redirect fails**: Check redirect URI matches exactly
- **Token refresh fails**: Verify refresh token is stored correctly
- **Stats not updating**: Check Cloud Functions logs
- **Encryption errors**: Verify encryption key is set correctly

## 🚀 Next Steps

1. Implement TikTok, Spotify, and SoundCloud OAuth flows
2. Add more detailed analytics (engagement, reach, etc.)
3. Implement conversion tracking
4. Add growth comparison graphs
5. Implement AI-based growth suggestions

