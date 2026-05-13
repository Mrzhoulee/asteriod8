'use strict';

// /api/config — public, safe-to-expose client config (PostHog project key etc.)
// The PostHog "project API key" is designed to be public; it identifies
// the project for ingestion, not authorize anything.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const POSTHOG_PROJECT_KEY = defineSecret('POSTHOG_PROJECT_KEY');

exports.publicConfig = onRequest(
  { region: 'us-central1', cors: true, secrets: [POSTHOG_PROJECT_KEY] },
  async (req, res) => {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
      posthogKey: process.env.POSTHOG_PROJECT_KEY || '',
      posthogHost: process.env.POSTHOG_API_HOST || 'https://us.i.posthog.com',
    });
  }
);
