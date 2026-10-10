'use strict';

const crypto = require('crypto');
const {
  verifyStripeSignature, parseReference, usdCents, processCheckoutSession, showArtists, pickArtist,
} = require('../stripe-perks');

function fakeDb(initial = {}) {
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
        once: async () => ({ exists: () => get(path) != null, val: () => get(path) }),
        update: async (updates) => { for (const [k, v] of Object.entries(updates)) set((path ? path + '/' : '') + k, v); },
      };
    },
  };
}

function session(over = {}) {
  return {
    id: 'cs_live_123',
    object: 'checkout.session',
    payment_status: 'paid',
    client_reference_id: 'nova__-Nshow1__shoutout__fan',
    amount_total: 500,
    currency: 'usd',
    customer_details: { email: 'Fan.One@Test.com', name: 'Otto Tan' },
    custom_fields: [
      { key: 'headsup', label: { type: 'custom', custom: 'Want a heads up for the next show?' }, type: 'dropdown',
        dropdown: { value: 'yesemailme', options: [{ label: 'Yes, email me', value: 'yesemailme' }, { label: 'No thanks', value: 'nothanks' }] } },
      { key: 'msg', label: { type: 'custom', custom: 'Your shoutout message' }, type: 'text', text: { value: '  Love\nthis set!  ' } },
    ],
    ...over,
  };
}

const baseDb = () => fakeDb({
  CONCERT_SCHEDULE: { '-Nshow1': { room: 'Room1', artist: 'Nova', startsAt: 1, endsAt: 2 } },
  CONCERT_CONFIG: { perks: [{ name: 'Shoutout', price: 5, url: 'https://buy.stripe.com/x' }] },
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test';
  const body = '{"id":"evt_1"}';
  const sign = (t, s = secret) => crypto.createHmac('sha256', s).update(`${t}.${body}`).digest('hex');
  test('accepts a valid signature', () => {
    expect(verifyStripeSignature(Buffer.from(body), `t=1000,v1=${sign(1000)}`, secret, 1000)).toBe(true);
  });
  test('rejects wrong secret, old timestamp and junk', () => {
    expect(verifyStripeSignature(Buffer.from(body), `t=1000,v1=${sign(1000, 'other')}`, secret, 1000)).toBe(false);
    expect(verifyStripeSignature(Buffer.from(body), `t=1000,v1=${sign(1000)}`, secret, 2000)).toBe(false);
    expect(verifyStripeSignature(Buffer.from(body), 'garbage', secret, 1000)).toBe(false);
    expect(verifyStripeSignature(Buffer.from(body), `t=1000,v1=${sign(1000)}`, '', 1000)).toBe(false);
  });
});

describe('parseReference', () => {
  test('reads artist, show, perk and who', () => {
    expect(parseReference('nova__-Nshow1__song_request__guest')).toEqual({ artistSlug: 'nova', showId: '-Nshow1', perk: 'song_request', who: 'guest' });
  });
  test('keeps show ids that contain a double underscore', () => {
    expect(parseReference('nova__-Na__b__shoutout__fan').showId).toBe('-Na__b');
  });
  test('ignores other payments', () => {
    expect(parseReference('')).toBeNull();
    expect(parseReference('premium_user_123')).toBeNull();
    expect(parseReference('a__b__c__someone')).toBeNull();
  });
});

describe('usdCents', () => {
  test('uses the USD source amount when the fan paid in a local currency', () => {
    expect(usdCents({ currency: 'thb', amount_total: 17500, currency_conversion: { source_currency: 'usd', amount_total: 500 } })).toBe(500);
    expect(usdCents({ currency: 'usd', amount_total: 1000 })).toBe(1000);
    expect(usdCents({ currency: 'eur', amount_total: 1000 })).toBe(0);
  });
});

describe('processCheckoutSession', () => {
  test('shows the shoutout, credits points, saves opt in and the order', async () => {
    const db = baseDb();
    const r = await processCheckoutSession(session(), db, 42);
    expect(r).toMatchObject({ ok: true, room: 'Room1', artist: 'Nova', perk: 'Shoutout', cents: 500, optIn: true });
    expect(db.data.CONCERT_SHOUTOUTS.Room1.cs_live_123).toEqual({ ts: 42, name: 'Otto', perk: 'Shoutout', message: 'Love this set!', artist: 'Nova', showId: '-Nshow1' });
    expect(db.data.REWARDS.tips['fan_one@test_com'].cs_live_123).toMatchObject({ amountCents: 500, artist: 'Nova', email: 'fan.one@test.com', source: 'stripe' });
    expect(db.data.FAN_OPTIN['fan_one@test_com'].nova).toMatchObject({ email: 'fan.one@test.com', artist: 'Nova' });
    expect(db.data.STRIPE_ORDERS.cs_live_123.fields).toHaveLength(2);
  });

  test('does nothing twice for the same payment', async () => {
    const db = baseDb();
    await processCheckoutSession(session(), db, 1);
    db.data.CONCERT_SHOUTOUTS.Room1.cs_live_123.message = 'edited by admin';
    const r = await processCheckoutSession(session(), db, 2);
    expect(r.skipped).toBe('already processed');
    expect(db.data.CONCERT_SHOUTOUTS.Room1.cs_live_123.message).toBe('edited by admin');
  });

  test('skips unpaid sessions and other Stripe payments', async () => {
    const db = baseDb();
    expect((await processCheckoutSession(session({ payment_status: 'unpaid' }), db)).skipped).toBeTruthy();
    expect((await processCheckoutSession(session({ client_reference_id: null }), db)).skipped).toBeTruthy();
    expect(db.data.STRIPE_ORDERS).toBeUndefined();
  });

  test('no opt in when they pick No thanks, no shoutout room for unknown shows without a room', async () => {
    const db = baseDb();
    const s = session({ client_reference_id: 'luna__-Nunknown__supporter__guest' });
    s.custom_fields[0].dropdown.value = 'nothanks';
    const r = await processCheckoutSession(s, db, 5);
    expect(r).toMatchObject({ ok: true, room: '', artist: 'Luna', perk: 'Supporter', optIn: false });
    expect(db.data.CONCERT_SHOUTOUTS).toBeUndefined();
    expect(db.data.FAN_OPTIN).toBeUndefined();
    expect(db.data.REWARDS.tips['fan_one@test_com']['cs_live_123'].amountCents).toBe(500);
  });

  test('unscheduled live room still gets the shoutout', async () => {
    const db = baseDb();
    const r = await processCheckoutSession(session({ client_reference_id: 'room2__room2__song_request__fan' }), db, 7);
    expect(r.room).toBe('Room2');
    expect(db.data.CONCERT_SHOUTOUTS.Room2.cs_live_123.perk).toBe('Song Request');
  });
});

describe('shows with several artists', () => {
  const multiDb = () => fakeDb({
    CONCERT_SCHEDULE: { '-Nduo': { room: 'Room3', artist: 'Nova, DJ Luna & Kai', artists: ['Nova', 'DJ Luna', 'Kai'], startsAt: 1, endsAt: 2 } },
    CONCERT_CONFIG: { perks: [{ name: 'Shoutout', price: 5, url: 'https://buy.stripe.com/x' }] },
  });

  test('reads the artist list, or the single artist of older shows', () => {
    expect(showArtists({ artists: ['Nova', ' nova ', 'Luna', ''] })).toEqual(['Nova', 'Luna']);
    expect(showArtists({ artists: { 0: 'Nova', 1: 'Luna' } })).toEqual(['Nova', 'Luna']);
    expect(showArtists({ artist: 'Nova' })).toEqual(['Nova']);
    expect(showArtists(null)).toEqual([]);
  });

  test('credits the artist the fan picked', async () => {
    const db = multiDb();
    const r = await processCheckoutSession(session({ client_reference_id: 'dj_luna__-Nduo__shoutout__fan' }), db, 9);
    expect(r).toMatchObject({ ok: true, room: 'Room3', artist: 'DJ Luna' });
    expect(db.data.CONCERT_SHOUTOUTS.Room3.cs_live_123.artist).toBe('DJ Luna');
    expect(db.data.REWARDS.tips['fan_one@test_com'].cs_live_123).toMatchObject({ amountCents: 500, artist: 'DJ Luna' });
    expect(db.data.FAN_OPTIN['fan_one@test_com'].dj_luna).toMatchObject({ artist: 'DJ Luna' });
    expect(db.data.STRIPE_ORDERS.cs_live_123.artist).toBe('DJ Luna');
  });

  test('older app versions that send the whole line up keep the combined name', () => {
    const show = { artist: 'Nova, DJ Luna & Kai', artists: ['Nova', 'DJ Luna', 'Kai'] };
    expect(pickArtist(show, 'nova_dj_luna_kai')).toBe('Nova, DJ Luna & Kai');
    expect(pickArtist(show, 'kai')).toBe('Kai');
    expect(pickArtist(show, 'someone_else')).toBe('Someone Else');
    expect(pickArtist({ artist: 'Nova' }, 'anything')).toBe('Nova');
  });
});
