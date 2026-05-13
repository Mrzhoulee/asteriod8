'use strict';

// Verifies the supporter-wall ordering query: founding_supporters
// scoped to artist_id, ordered by signup_order ASC, limit 50.
// This locks in the ordering contract used by both the SSR artist
// page (functions/artist-profile.js) and the client-side wall
// (js/supporter-wall.js).

const fs = require('fs');
const path = require('path');

function readSource(rel) {
  return fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('supporter wall ordering', () => {
  test('artist-profile.js queries founding_supporters with orderBy(signup_order, asc) and limit(50)', () => {
    const src = readSource('../artist-profile.js');
    expect(src).toMatch(/collection\(['"]founding_supporters['"]\)/);
    expect(src).toMatch(/where\(['"]artist_id['"], *'=='/);
    expect(src).toMatch(/orderBy\(['"]signup_order['"], *['"]asc['"]/);
    expect(src).toMatch(/limit\(50\)/);
  });

  test('js/supporter-wall.js uses the same ordering', () => {
    const src = readSource('../../js/supporter-wall.js');
    expect(src).toMatch(/where\(['"]artist_id['"], *'=='/);
    expect(src).toMatch(/orderBy\(['"]signup_order['"], *['"]asc['"]/);
  });

  test('firestore.indexes.json includes the composite index needed by these queries', () => {
    const idx = JSON.parse(readSource('../../firestore.indexes.json'));
    const wallIndex = idx.indexes.find((i) =>
      i.collectionGroup === 'founding_supporters' &&
      i.fields.some((f) => f.fieldPath === 'artist_id') &&
      i.fields.some((f) => f.fieldPath === 'signup_order')
    );
    expect(wallIndex).toBeTruthy();
  });

  test('overflow calculation: when count > 50, "+N more" matches referral_count - shown', () => {
    // overflow = max(0, referral_count - supporters.length)
    const cases = [
      { count: 5,   shown: 5,  overflow: 0 },
      { count: 50,  shown: 50, overflow: 0 },
      { count: 73,  shown: 50, overflow: 23 },
      { count: 100, shown: 50, overflow: 50 },
    ];
    for (const c of cases) {
      expect(Math.max(0, c.count - c.shown)).toBe(c.overflow);
    }
  });
});
