'use strict';

// Pure logic for the free concert pass emails (no firebase imports, so it is easy to test).
// The scheduled function lives in concert-pass-emails.js.

const SITE = 'https://www.asteroid8.net/';
const FROM = 'Asteroid <hello@asteroid8.net>';
const MIN = 60 * 1000;
const REMIND_BEFORE = 60 * MIN;          // the reminder goes out in the hour before a night
const REMIND_LATE = 15 * MIN;            // or up to 15 minutes after it started, if a run was late
const CONFIRM_MIN_LEAD = 15 * MIN;       // no confirmation for a night that starts within 15 minutes
const SKIP_REMIND_AFTER_CLAIM = 90 * MIN; // pass claimed in the last 90 minutes: no reminder needed
const MAX_EMAILS_PER_RUN = 300;
const BATCH = 100;                       // Resend batch limit

const ROOM_RE = /^Room([1-5])$/;
const IG_HANDLE = 'asteroidincofficial';
const IG_DM_URL = 'https://ig.me/m/' + IG_HANDLE;

function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function lineupLabel(list) {
  const a = list.filter(Boolean);
  if (a.length <= 1) return a[0] || 'Asteroid artists';
  return a.slice(0, -1).join(', ') + ' & ' + a[a.length - 1];
}

/** CONCERT_SCHEDULE -> [{id, room, artists, lineup, startsAt, endsAt}] */
function parseShows(schedule) {
  const out = [];
  for (const [id, s] of Object.entries(schedule || {})) {
    if (!s || typeof s !== 'object') continue;
    const startsAt = Number(s.startsAt);
    const endsAt = Number(s.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt || !ROOM_RE.test(s.room)) continue;
    const raw = Array.isArray(s.artists) ? s.artists : s.artists && typeof s.artists === 'object' ? Object.values(s.artists) : [];
    let artists = raw.map((x) => cleanText(typeof x === 'string' ? x : '', 80)).filter(Boolean);
    if (!artists.length && s.artist) artists = [cleanText(s.artist, 80)];
    out.push({ id, room: s.room, artists, lineup: lineupLabel(artists), startsAt, endsAt });
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

function cleanTz(tz) {
  const t = typeof tz === 'string' ? tz.trim() : '';
  if (t) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: t }); return t; } catch (e) { /* fall through */ }
  }
  return 'America/New_York';
}

/** "Fri, Oct 23, 8:30 PM EDT" in the fan's time zone. */
function fmtLocal(ms, tz) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: cleanTz(tz), weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(ms));
}

/** "8:30 PM ET / 5:30 PM PT" */
function fmtUs(ms) {
  const t = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
  return t('America/New_York') + ' ET / ' + t('America/Los_Angeles') + ' PT';
}

function watchUrl(show) {
  const m = ROOM_RE.exec(show.room);
  return SITE + (m ? 'liveroom' + m[1] + '.html' : 'lively.html');
}

function calStamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function isHalloween(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit' }).format(new Date(ms)) === '10-31';
}

function googleCalUrl(show) {
  const title = (isHalloween(show.startsAt) ? 'Halloween concert' : 'Live concert') + ' on Asteroid: ' + show.lineup;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
    '&dates=' + calStamp(show.startsAt) + '/' + calStamp(show.endsAt) +
    '&details=' + encodeURIComponent('Lineup: ' + show.lineup + '\nWatch free: ' + watchUrl(show)) +
    '&location=' + encodeURIComponent(watchUrl(show));
}

/**
 * What to send now.
 * @returns {{confirmations: Array, reminders: Array, skips: Object}} skips = flag updates for
 *   emails that are pointless now (night about to start, confirmation just sent).
 */
function planEmails({ schedule, passes, mail, now }) {
  const shows = parseShows(schedule).filter((s) => s.endsAt > now);
  const confirmations = new Map();
  const reminders = [];
  const skips = {};
  for (const show of shows) {
    const byUk = (passes && passes[show.id]) || {};
    for (const [uk, p] of Object.entries(byUk)) {
      if (!p || typeof p !== 'object' || typeof p.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) continue;
      const flags = (mail && mail[show.id] && mail[show.id][uk]) || {};
      const fan = { uk, email: p.email.trim(), name: cleanText(p.name, 60), tz: cleanTz(p.tz) };
      const lead = show.startsAt - now;
      let confirmingNow = false;
      if (!flags.confirmedAt) {
        if (lead > CONFIRM_MIN_LEAD) {
          if (!confirmations.has(uk)) confirmations.set(uk, { ...fan, shows: [] });
          confirmations.get(uk).shows.push(show);
          confirmingNow = true;
        } else {
          skips[show.id + '/' + uk + '/confirmedAt'] = now;
          skips[show.id + '/' + uk + '/confirmSkipped'] = true;
        }
      }
      if (!flags.remindedAt && lead <= REMIND_BEFORE && lead > -REMIND_LATE) {
        const justClaimed = Number(p.ts) > now - SKIP_REMIND_AFTER_CLAIM;
        if (confirmingNow || justClaimed) {
          skips[show.id + '/' + uk + '/remindedAt'] = now;
          skips[show.id + '/' + uk + '/remindSkipped'] = true;
        } else {
          reminders.push({ ...fan, show });
        }
      }
    }
  }
  return { confirmations: [...confirmations.values()], reminders, skips };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapHtml(inner) {
  return '<!doctype html><html><body style="margin:0;background:#0b0c11;padding:24px 12px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#f4f4f8">' +
    '<div style="max-width:480px;margin:0 auto;background:#15161c;border:1px solid #2a2b33;border-radius:16px;padding:24px 20px">' +
    '<div style="font-weight:800;font-size:20px;margin:0 0 18px">asteroid<span style="color:#ff7f50">.</span></div>' + inner +
    '<p style="font-size:12px;color:#9a9aa5;line-height:1.6;margin:22px 0 0">Can\'t make it? <a href="' + SITE + 'pass" style="color:#ffad8f">Remove a night from your pass</a> and you won\'t get its reminder.</p>' +
    '</div></body></html>';
}

function button(href, label) {
  return '<a href="' + esc(href) + '" style="display:inline-block;background:#ff7f50;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 16px;border-radius:10px;margin:4px 6px 4px 0">' + esc(label) + '</a>';
}

function confirmationEmail(c) {
  const hi = c.name ? 'Hi ' + c.name + ',' : 'Hi,';
  const n = c.shows.length;
  const first = c.shows[0];
  const subject = n === 1 ? "You're in: " + first.lineup + ' live on Asteroid' : "You're in for " + n + ' nights on Asteroid';
  const nightText = (s) => fmtLocal(s.startsAt, c.tz) + '\nLineup: ' + s.lineup + '\nWatch: ' + watchUrl(s) + '\nAdd to Google Calendar: ' + googleCalUrl(s);
  const bs = c.backstage;
  const bsText = bs ? '\n\nBackstage: DM your code ' + bs.code + ' to @' + IG_HANDLE + ' on Instagram' + (bs.points > 0 ? ' for +' + bs.points + ' points' : '') +
    ". We'll reply and message you when new shows drop: " + IG_DM_URL : '';
  const text = hi + "\n\nYou're in! Here's your free pass:\n\n" + c.shows.map(nightText).join('\n\n') +
    "\n\nWe'll email you an hour before " + (n === 1 ? 'it starts' : 'each night') + '. Fans earn points for every show they watch, and you can spend them on gift cards and shoutouts.' +
    bsText + "\n\nCan't make it? Remove a night from your pass: " + SITE + 'pass\n\nSee you there,\nAsteroid';
  const html = wrapHtml(
    '<p style="font-size:15px;margin:0 0 6px">' + esc(hi) + '</p><h1 style="font-size:22px;margin:0 0 16px">You\'re in!</h1>' +
    c.shows.map((s) => '<div style="border-top:1px solid #2a2b33;padding:14px 0">' +
      '<div style="font-weight:700;font-size:16px">' + esc(fmtLocal(s.startsAt, c.tz)) + '</div>' +
      '<div style="font-size:13px;color:#b5b5c0;margin:4px 0 10px">' + esc(s.lineup) + ' · ' + esc(fmtUs(s.startsAt)) + '</div>' +
      button(watchUrl(s), 'Watch link') + button(googleCalUrl(s), 'Add to calendar') + '</div>').join('') +
    '<p style="font-size:14px;line-height:1.6;color:#d8d8e0;margin:12px 0 0">We\'ll email you an hour before ' + (n === 1 ? 'it starts' : 'each night') +
    '. Fans earn points for every show they watch, and you can spend them on gift cards and shoutouts.</p>' +
    (bs ? '<div style="border:1px dashed #ff7f50;border-radius:12px;padding:14px;margin:16px 0 0">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#ff7f50">BACKSTAGE</div>' +
      '<div style="font-size:24px;font-weight:800;letter-spacing:.18em;margin:8px 0">' + esc(bs.code) + '</div>' +
      '<p style="font-size:14px;line-height:1.5;color:#d8d8e0;margin:0 0 10px">DM this code to @' + IG_HANDLE + ' on Instagram' + (bs.points > 0 ? ' for +' + bs.points + ' points' : '') +
      '. We\'ll reply and message you when new shows drop.</p>' + button(IG_DM_URL, 'DM us on Instagram') + '</div>' : ''));
  return { subject, text, html };
}

function reminderEmail(r, now) {
  const hi = r.name ? 'Hi ' + r.name + ',' : 'Hi,';
  const lead = r.show.startsAt - now;
  const started = lead <= 0;
  const heading = started ? 'Live now' : lead > 40 * MIN ? 'Starting in 1 hour' : 'Starting soon';
  const subject = heading + ': ' + r.show.lineup + ' on Asteroid';
  const when = started ? 'is live on Asteroid right now' : 'goes live on Asteroid at ' + fmtLocal(r.show.startsAt, r.tz);
  const text = hi + '\n\n' + r.show.lineup + ' ' + when + ' (' + fmtUs(r.show.startsAt) + ').\n\nWatch here: ' + watchUrl(r.show) +
    '\n\nCome a few minutes early and say hi in the chat.\n\nSee you there,\nAsteroid';
  const html = wrapHtml(
    '<p style="font-size:15px;margin:0 0 6px">' + esc(hi) + '</p><h1 style="font-size:22px;margin:0 0 10px">' + heading + '</h1>' +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 16px"><b>' + esc(r.show.lineup) + '</b> ' + esc(when) + ' (' + esc(fmtUs(r.show.startsAt)) + ').</p>' +
    button(watchUrl(r.show), started ? 'Watch now' : 'Open the show') +
    '<p style="font-size:14px;color:#d8d8e0;margin:14px 0 0">Come a few minutes early and say hi in the chat.</p>');
  return { subject, text, html };
}

/**
 * One run: plan, send in batches, then save sent flags.
 * @param {object} db firebase-admin database()
 * @param {function} sendBatch async (emails[]) => void, throws on failure
 */
async function runPassEmails(db, sendBatch, now = Date.now()) {
  const [schedSnap, passSnap, mailSnap, bsSnap, bsPtsSnap] = await Promise.all([
    db.ref('CONCERT_SCHEDULE').once('value'),
    db.ref('CONCERT_PASSES').once('value'),
    db.ref('CONCERT_PASS_MAIL').once('value'),
    db.ref('BACKSTAGE').once('value'),
    db.ref('CONCERT_CONFIG/backstagePoints').once('value'),
  ]);
  const plan = planEmails({ schedule: schedSnap.val(), passes: passSnap.val(), mail: mailSnap.val(), now });
  const backstage = bsSnap.val() || {};
  const ptsRaw = Number(bsPtsSnap.val());
  const bsPoints = bsPtsSnap.val() != null && Number.isFinite(ptsRaw) && ptsRaw >= 0 ? Math.round(ptsRaw) : 100;
  const jobs = [];
  for (const c of plan.confirmations) {
    const b = backstage[c.uk];
    if (b && typeof b.code === 'string' && /^AST[A-Z0-9]{5}$/.test(b.code) && !b.verifiedAt) c.backstage = { code: b.code, points: bsPoints };
    jobs.push({ email: { to: [c.email], ...confirmationEmail(c) }, flags: c.shows.map((s) => s.id + '/' + c.uk + '/confirmedAt') });
  }
  for (const r of plan.reminders) {
    jobs.push({ email: { to: [r.email], ...reminderEmail(r, now) }, flags: [r.show.id + '/' + r.uk + '/remindedAt'] });
  }
  const todo = jobs.slice(0, MAX_EMAILS_PER_RUN);
  const updates = {};
  for (const [k, v] of Object.entries(plan.skips)) updates['CONCERT_PASS_MAIL/' + k] = v;
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const part = todo.slice(i, i + BATCH);
    try {
      await sendBatch(part.map((j) => ({ from: FROM, ...j.email })));
      for (const j of part) for (const f of j.flags) updates['CONCERT_PASS_MAIL/' + f] = now;
      sent += part.length;
    } catch (e) {
      failed += part.length;
      console.error('[concertPassEmails] send failed', e && e.message);
    }
  }
  if (Object.keys(updates).length) await db.ref().update(updates);
  return { confirmations: plan.confirmations.length, reminders: plan.reminders.length, sent, failed, skipped: Object.keys(plan.skips).length / 2 };
}

module.exports = {
  parseShows, planEmails, confirmationEmail, reminderEmail, runPassEmails, fmtLocal, fmtUs, cleanTz, googleCalUrl, watchUrl,
};
