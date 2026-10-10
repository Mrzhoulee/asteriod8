'use strict';

// Stripe webhook for concert fan perks (Shoutout, Song request, Supporter...).
// Setup: Stripe Dashboard > Developers > Webhooks > Add endpoint
//   URL:   https://us-central1-asteroid-cdc13.cloudfunctions.net/stripeWebhook
//   Event: checkout.session.completed
// then: firebase functions:secrets:set STRIPE_WEBHOOK_SECRET  (the whsec_... signing secret)

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { verifyStripeSignature, processCheckoutSession } = require('./stripe-perks');

const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

exports.stripeWebhook = onRequest(
  { region: 'us-central1', secrets: [STRIPE_WEBHOOK_SECRET], maxInstances: 5 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('POST only');
      return;
    }
    const raw = req.rawBody;
    if (!verifyStripeSignature(raw, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
      console.warn('[stripeWebhook] bad signature');
      res.status(400).send('Bad signature');
      return;
    }
    let event;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch (e) {
      res.status(400).send('Bad JSON');
      return;
    }
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      res.json({ received: true, ignored: event.type });
      return;
    }
    try {
      const result = await processCheckoutSession(event.data && event.data.object, admin.database());
      console.log('[stripeWebhook]', event.id, JSON.stringify(result));
      res.json({ received: true });
    } catch (e) {
      console.error('[stripeWebhook] failed', event.id, e);
      res.status(500).send('Error');
    }
  }
);
