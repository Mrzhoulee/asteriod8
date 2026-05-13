'use strict';

// jest.mock is hoisted; use require-inside-factory to share the singleton mock.
jest.mock('firebase-admin', () => require('./_mocks').getMock().admin);
jest.mock('firebase-functions/v2/https',      () => ({ onRequest:  () => () => {} }));
jest.mock('firebase-functions/v2/scheduler',  () => ({ onSchedule: () => () => {} }));
jest.mock('firebase-functions/v2',            () => ({ logger: { info() {}, warn() {}, error() {} } }));
jest.mock('firebase-functions/params',        () => ({ defineSecret: () => ({}) }));

const { getMock } = require('./_mocks');
const mock = getMock();
const referrals = require('../referrals');

describe('checkMilestones', () => {
  beforeEach(() => mock.reset());

  test('exports the five milestone thresholds in order', () => {
    expect(referrals.MILESTONES.map((m) => m.count)).toEqual([5, 10, 25, 50, 100]);
    expect(referrals.MILESTONES.map((m) => m.tier))
      .toEqual(['supporter', 'trailblazer', 'featured', 'partner', 'equity_eligible']);
  });

  test('returns empty when no threshold is crossed', async () => {
    mock.setDoc('users/artist1', { referral_count: 2, username: 'A' });
    const out = await referrals.checkMilestones('artist1', 1, 2);
    expect(out).toEqual([]);
  });

  test('awards exactly milestone 5 when crossing 4 → 5', async () => {
    mock.setDoc('users/artist1', { referral_count: 5, username: 'A', email: 'a@x.com' });
    const out = await referrals.checkMilestones('artist1', 4, 5);
    expect(out.map((o) => o.milestone)).toEqual([5]);
    const auditCreates = mock.calls.create.filter((c) => c.path.startsWith('audit_log/'));
    expect(auditCreates.map((c) => c.path)).toEqual(['audit_log/artist1_milestone_5']);
  });

  test('awards both milestones when 4 → 12', async () => {
    mock.setDoc('users/artist1', { referral_count: 12, username: 'A' });
    const out = await referrals.checkMilestones('artist1', 4, 12);
    expect(out.map((o) => o.milestone)).toEqual([5, 10]);
  });

  test('idempotent — second invocation returns empty (ALREADY_EXISTS swallowed)', async () => {
    mock.setDoc('users/artist1', { referral_count: 5, username: 'A' });
    const first = await referrals.checkMilestones('artist1', 4, 5);
    expect(first.length).toBe(1);
    const second = await referrals.checkMilestones('artist1', 4, 5);
    expect(second).toEqual([]);
  });

  test('writes inbox row to RTDB after awarding', async () => {
    mock.setDoc('users/artist1', { referral_count: 5, username: 'A' });
    await referrals.checkMilestones('artist1', 4, 5);
    const inboxWrites = mock.calls.rtdbSet.filter((w) => w.path.startsWith('artistInbox/'));
    expect(inboxWrites.length).toBe(1);
    expect(inboxWrites[0].path).toMatch(/^artistInbox\/artist1\/mock-push-/);
  });
});
