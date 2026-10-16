'use strict';

const { parseShows, planEmails, confirmationEmail, reminderEmail, runPassEmails, fmtLocal, fmtUs, cleanTz } = require('../concert-pass-mail');

const MIN = 60 * 1000;
const H = 60 * MIN;
// Fri Oct 23 2026, 8:30 PM ET = Sat 00:30 UTC
const FRI = Date.UTC(2026, 9, 24, 0, 30);
const SAT = FRI + 24 * H;

const schedule = {
  fri: { room: 'Room2', artist: 'Syante & Elihu', artists: ['Syante', 'Elihu'], startsAt: FRI, endsAt: FRI + 2 * H },
  sat: { room: 'Room1', artist: 'AURAQL', artists: ['AURAQL'], startsAt: SAT, endsAt: SAT + 2 * H },
  old: { room: 'Room1', artist: 'Past', startsAt: FRI - 72 * H, endsAt: FRI - 70 * H },
  bad: { room: 'Room9', artist: 'Nope', startsAt: FRI, endsAt: FRI + H },
};
const pass = (over = {}) => ({ ts: FRI - 48 * H, email: 'fan@test.com', name: 'Ana', tz: 'America/Chicago', via: 'syante', ...over });

function fakeDb(initial) {
  const data = JSON.parse(JSON.stringify(initial));
  const get = (path) => path.split('/').filter(Boolean).reduce((n, k) => (n == null ? null : n[k] === undefined ? null : n[k]), data);
  const set = (path, value) => {
    const parts = path.split('/').filter(Boolean);
    let n = data;
    for (let i = 0; i < parts.length - 1; i++) n = n[parts[i]] = n[parts[i]] || {};
    n[parts[parts.length - 1]] = value;
  };
  return {
    data,
    ref(path = '') {
      return {
        once: async () => ({ val: () => get(path) }),
        update: async (u) => { for (const [k, v] of Object.entries(u)) set((path ? path + '/' : '') + k, v); },
      };
    },
  };
}

describe('times', () => {
  test('fan time zone, with ET for a bad one', () => {
    expect(fmtLocal(FRI, 'America/Chicago')).toBe('Fri, Oct 23, 7:30 PM CDT');
    expect(fmtLocal(FRI, 'Not/AZone')).toBe('Fri, Oct 23, 8:30 PM EDT');
    expect(cleanTz('')).toBe('America/New_York');
    expect(fmtUs(FRI)).toBe('8:30 PM ET / 5:30 PM PT');
  });
  test('reads only valid shows, oldest first', () => {
    const s = parseShows(schedule);
    expect(s.map((x) => x.id)).toEqual(['old', 'fri', 'sat']);
    expect(s[1].lineup).toBe('Syante & Elihu');
  });
});

describe('planEmails', () => {
  test('one confirmation per fan for all new nights', () => {
    const passes = { fri: { fan_uk: pass() }, sat: { fan_uk: pass(), other_uk: pass({ email: 'b@test.com', name: '' }) } };
    const p = planEmails({ schedule, passes, mail: {}, now: FRI - 47 * H });
    expect(p.confirmations).toHaveLength(2);
    const fan = p.confirmations.find((c) => c.uk === 'fan_uk');
    expect(fan.shows.map((s) => s.id)).toEqual(['fri', 'sat']);
    expect(p.reminders).toHaveLength(0);
  });

  test('no confirmation twice, reminder in the last hour only', () => {
    const passes = { fri: { fan_uk: pass() } };
    const mail = { fri: { fan_uk: { confirmedAt: FRI - 47 * H } } };
    expect(planEmails({ schedule, passes, mail, now: FRI - 2 * H }).reminders).toHaveLength(0);
    const p = planEmails({ schedule, passes, mail, now: FRI - 55 * MIN });
    expect(p.confirmations).toHaveLength(0);
    expect(p.reminders).toHaveLength(1);
    expect(p.reminders[0].show.id).toBe('fri');
    const done = { fri: { fan_uk: { confirmedAt: 1, remindedAt: FRI - 55 * MIN } } };
    expect(planEmails({ schedule, passes, mail: done, now: FRI - 45 * MIN }).reminders).toHaveLength(0);
  });

  test('a late run still reminds up to 15 minutes after the start, not later', () => {
    const passes = { fri: { fan_uk: pass() } };
    const mail = { fri: { fan_uk: { confirmedAt: 1 } } };
    expect(planEmails({ schedule, passes, mail, now: FRI + 10 * MIN }).reminders).toHaveLength(1);
    expect(planEmails({ schedule, passes, mail, now: FRI + 20 * MIN }).reminders).toHaveLength(0);
  });

  test('pass claimed in the last 90 minutes: confirmation only, reminder skipped', () => {
    const passes = { fri: { fan_uk: pass({ ts: FRI - 80 * MIN }) } };
    const p = planEmails({ schedule, passes, mail: {}, now: FRI - 50 * MIN });
    expect(p.confirmations).toHaveLength(1);
    expect(p.reminders).toHaveLength(0);
    expect(p.skips['fri/fan_uk/remindedAt']).toBe(FRI - 50 * MIN);
  });

  test('night about to start: no confirmation, no reminder for a pass claimed just now', () => {
    const passes = { fri: { fan_uk: pass({ ts: FRI - 10 * MIN }) } };
    const p = planEmails({ schedule, passes, mail: {}, now: FRI - 5 * MIN });
    expect(p.confirmations).toHaveLength(0);
    expect(p.reminders).toHaveLength(0);
    expect(p.skips['fri/fan_uk/confirmSkipped']).toBe(true);
    expect(p.skips['fri/fan_uk/remindSkipped']).toBe(true);
  });

  test('ended nights and bad emails are ignored', () => {
    const passes = { old: { fan_uk: pass() }, fri: { x_uk: pass({ email: 'not an email' }) } };
    const p = planEmails({ schedule, passes, mail: {}, now: FRI - 47 * H });
    expect(p.confirmations).toHaveLength(0);
  });
});

describe('email text', () => {
  test('confirmation lists each night in the fan time zone with watch and calendar links', () => {
    const shows = parseShows(schedule).filter((s) => s.id !== 'old');
    const e = confirmationEmail({ name: 'Ana', tz: 'America/Chicago', shows });
    expect(e.subject).toBe("You're in for 2 nights on Asteroid");
    expect(e.text).toContain('Fri, Oct 23, 7:30 PM CDT');
    expect(e.text).toContain('Lineup: Syante & Elihu');
    expect(e.text).toContain('https://www.asteroid8.net/liveroom2.html');
    expect(e.text).toContain('calendar.google.com');
    expect(e.html).toContain('Syante &amp; Elihu');
    const one = confirmationEmail({ name: '', tz: 'America/New_York', shows: [shows[1]] });
    expect(one.subject).toBe("You're in: AURAQL live on Asteroid");
    expect(one.text.startsWith('Hi,')).toBe(true);
  });

  test('reminder subject follows the time left', () => {
    const show = parseShows(schedule).find((s) => s.id === 'fri');
    expect(reminderEmail({ name: 'Ana', tz: 'America/Chicago', show }, FRI - 55 * MIN).subject).toBe('Starting in 1 hour: Syante & Elihu on Asteroid');
    expect(reminderEmail({ name: 'Ana', tz: 'America/Chicago', show }, FRI - 20 * MIN).subject).toBe('Starting soon: Syante & Elihu on Asteroid');
    const live = reminderEmail({ name: 'Ana', tz: 'America/Chicago', show }, FRI + 5 * MIN);
    expect(live.subject).toBe('Live now: Syante & Elihu on Asteroid');
    expect(live.text).toContain('Watch here: https://www.asteroid8.net/liveroom2.html');
  });
});

describe('runPassEmails', () => {
  test('sends, then saves flags so the next run sends nothing', async () => {
    const db = fakeDb({ CONCERT_SCHEDULE: schedule, CONCERT_PASSES: { fri: { fan_uk: pass() }, sat: { fan_uk: pass() } } });
    const sent = [];
    const send = async (emails) => { sent.push(...emails); };
    const r1 = await runPassEmails(db, send, FRI - 47 * H);
    expect(r1).toMatchObject({ confirmations: 1, sent: 1, failed: 0 });
    expect(sent[0]).toMatchObject({ from: 'Asteroid <hello@asteroid8.net>', to: ['fan@test.com'] });
    expect(db.data.CONCERT_PASS_MAIL.fri.fan_uk.confirmedAt).toBe(FRI - 47 * H);
    expect(db.data.CONCERT_PASS_MAIL.sat.fan_uk.confirmedAt).toBe(FRI - 47 * H);
    const r2 = await runPassEmails(db, send, FRI - 46 * H);
    expect(r2.sent).toBe(0);
    const r3 = await runPassEmails(db, send, FRI - 50 * MIN);
    expect(r3).toMatchObject({ reminders: 1, sent: 1 });
    expect(sent[1].subject).toBe('Starting in 1 hour: Syante & Elihu on Asteroid');
  });

  test('a failed send keeps the flags off so the next run tries again', async () => {
    const db = fakeDb({ CONCERT_SCHEDULE: schedule, CONCERT_PASSES: { fri: { fan_uk: pass() } } });
    const r = await runPassEmails(db, async () => { throw new Error('domain not verified'); }, FRI - 47 * H);
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect(db.data.CONCERT_PASS_MAIL).toBeUndefined();
  });
});
