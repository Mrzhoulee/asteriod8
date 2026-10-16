'use strict';

// Calendar file for concert nights: GET /concertIcs?s=<showId>[,<showId>...]
// pass.html links here on iPhones and in the iOS app, and the confirmation email links here
// as "Apple Calendar": iOS opens a text/calendar link straight into the Calendar app, which a
// downloaded file can't do. Desktop browsers just download it.
// Deploy: firebase deploy --only functions:default:concertIcs

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { icsResponse } = require('./concert-pass-mail');

exports.concertIcs = onRequest(
  { region: 'us-central1', cors: true, maxInstances: 5, timeoutSeconds: 20 },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).send('Use GET'); return; }
    const snap = await admin.database().ref('CONCERT_SCHEDULE').once('value');
    const r = icsResponse(snap.val(), req.query.s);
    if (r.status !== 200) {
      res.status(r.status).set('Content-Type', 'text/plain; charset=utf-8').send(r.body);
      return;
    }
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="asteroid-concert.ics"');
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).send(r.body);
  }
);
