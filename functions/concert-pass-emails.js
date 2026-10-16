'use strict';

// Free concert pass emails (pass.html). Runs every 10 minutes:
//   1. one confirmation per fan for the nights they just added to their pass,
//      with watch and calendar links
//   2. one reminder an hour before each night on their pass
// Sent flags live in CONCERT_PASS_MAIL/{showId}/{uk}, so nobody gets the same email twice.
//
// Setup (once): verify asteroid8.net in Resend (resend.com > Domains, add the DNS records it
// shows in GoDaddy), then: firebase functions:secrets:set RESEND_API_KEY
// Deploy:       firebase deploy --only functions:default:concertPassEmails,functions:default:concertIcs

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { runPassEmails } = require('./concert-pass-mail');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

let ResendCtor;
exports.concertPassEmails = onSchedule(
  { schedule: 'every 10 minutes', region: 'us-central1', secrets: [RESEND_API_KEY], timeoutSeconds: 120, maxInstances: 1 },
  async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) { logger.warn('[concertPassEmails] RESEND_API_KEY is not set'); return; }
    if (!ResendCtor) ResendCtor = require('resend').Resend;
    const resend = new ResendCtor(key);
    const result = await runPassEmails(admin.database(), async (emails) => {
      const { error } = await resend.batch.send(emails);
      if (error) throw new Error(error.message || String(error));
    });
    logger.info('[concertPassEmails]', result);
  }
);

