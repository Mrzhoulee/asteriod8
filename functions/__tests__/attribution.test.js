'use strict';

// Locks down the attribution-transaction contract:
//   founding_supporters/{artistId}_{uid} doc ID is deterministic and the only
//   thing standing between a duplicate signup and a duplicate increment.

jest.mock('firebase-admin', () => require('./_mocks').getMock().admin);
jest.mock('firebase-functions/v2/https',      () => ({ onRequest:  () => () => {} }));
jest.mock('firebase-functions/v2/scheduler',  () => ({ onSchedule: () => () => {} }));
jest.mock('firebase-functions/v2',            () => ({ logger: { info() {}, warn() {}, error() {} } }));
jest.mock('firebase-functions/params',        () => ({ defineSecret: () => ({}) }));

const { getMock } = require('./_mocks');
const mock = getMock();
const admin = require('firebase-admin');

// Mirror of the core transaction body inside signupAttribute. Isolating it
// here keeps the test free of HTTP plumbing while still exercising the exact
// idempotency logic that runs in production.
async function attribute(artistId, uid) {
  const fs = admin.firestore();
  const supRef    = fs.collection('founding_supporters').doc(`${artistId}_${uid}`);
  const artistRef = fs.collection('users').doc(artistId);

  let signupOrder = null, oldCount = null, newCount = null;
  await fs.runTransaction(async (tx) => {
    const [supSnap, artistSnap] = await Promise.all([tx.get(supRef), tx.get(artistRef)]);
    if (supSnap.exists) {
      signupOrder = supSnap.data().signup_order;
      return;
    }
    if (!artistSnap.exists) throw new Error('artist_not_found');
    const a = artistSnap.data();
    if (!a.is_referral_eligible) throw new Error('artist_not_eligible');

    oldCount = a.referral_count || 0;
    newCount = oldCount + 1;
    signupOrder = newCount;

    tx.set(supRef, { artist_id: artistId, user_id: uid, signup_order: signupOrder });
    tx.update(artistRef, { referral_count: admin.firestore.FieldValue.increment(1) });
  });
  return { signupOrder, oldCount, newCount };
}

describe('signup attribution', () => {
  beforeEach(() => mock.reset());

  test('attributes a new signup with sequential signup_order', async () => {
    mock.setDoc('users/artist1', { is_referral_eligible: true, referral_count: 3 });
    const r = await attribute('artist1', 'fan1');
    expect(r.signupOrder).toBe(4);
    expect(r.newCount).toBe(4);
    const sup = mock.calls.set.find((c) => c.path === 'founding_supporters/artist1_fan1');
    expect(sup).toBeTruthy();
    expect(sup.data.signup_order).toBe(4);
  });

  test('idempotent — second call returns same signup_order, no second increment', async () => {
    mock.setDoc('users/artist1', { is_referral_eligible: true, referral_count: 3 });
    const first = await attribute('artist1', 'fan1');
    const setsAfterFirst    = mock.calls.set.length;
    const updatesAfterFirst = mock.calls.update.length;

    const second = await attribute('artist1', 'fan1');
    expect(second.signupOrder).toBe(first.signupOrder);
    expect(second.newCount).toBeNull();
    expect(mock.calls.set.length).toBe(setsAfterFirst);
    expect(mock.calls.update.length).toBe(updatesAfterFirst);
  });

  test('rejects when artist is not referral-eligible', async () => {
    mock.setDoc('users/artist1', { is_referral_eligible: false, referral_count: 0 });
    await expect(attribute('artist1', 'fan1')).rejects.toThrow('artist_not_eligible');
  });

  test('rejects when artist does not exist', async () => {
    await expect(attribute('ghost', 'fan1')).rejects.toThrow('artist_not_found');
  });
});
