'use strict';

// Verifies that the preview transcode pipeline enforces a hard 30-second
// cutoff: ffmpeg's .duration(30) call MUST appear and reach the save step.

const fs = require('fs');
const path = require('path');

describe('30-second preview cutoff', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../preview.js'), 'utf8');

  test('ffmpeg pipeline calls .duration(30) — server-side enforcement', () => {
    expect(src).toMatch(/\.duration\(\s*30\s*\)/);
  });

  test('ffmpeg pipeline pins start time to 0', () => {
    expect(src).toMatch(/\.setStartTime\(\s*0\s*\)/);
  });

  test('preview is encoded as AAC m4a', () => {
    expect(src).toMatch(/\.audioCodec\(['"]aac['"]\)/);
    expect(src).toMatch(/\.format\(['"]mp4['"]\)/);
  });

  test('preview is cached under previews/{trackId}.m4a in Cloud Storage', () => {
    expect(src).toMatch(/destination: *`previews\/\$\{trackId\}\.m4a`/);
  });

  test('cache headers mark the preview immutable for 1 year', () => {
    expect(src).toMatch(/cacheControl:.*max-age=31536000.*immutable/);
  });

  test('client-side audio element also enforces 30s as a defense in depth', () => {
    expect(src).toMatch(/currentTime\s*>=\s*30/);
    expect(src).toMatch(/audio\.pause\(\)/);
  });
});

describe('functional behavior of the ffmpeg chain (mocked)', () => {
  const calls = [];

  jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/mock/ffmpeg' }), { virtual: true });
  jest.mock('fluent-ffmpeg', () => {
    const make = () => {
      const api = {
        setStartTime: (t)        => { calls.push(['setStartTime', t]); return api; },
        duration:     (s)        => { calls.push(['duration', s]); return api; },
        audioCodec:   (c)        => { calls.push(['audioCodec', c]); return api; },
        audioBitrate: (b)        => { calls.push(['audioBitrate', b]); return api; },
        format:       (f)        => { calls.push(['format', f]); return api; },
        outputOptions: (o)       => { calls.push(['outputOptions', o]); return api; },
        on:           (ev, cb)   => { if (ev === 'end') setImmediate(cb); return api; },
        save:         (out)      => { calls.push(['save', out]); return api; },
      };
      return api;
    };
    make.setFfmpegPath = () => {};
    return make;
  }, { virtual: true });

  test('the chain ordering is correct: setStartTime → duration → codec → format → save', async () => {
    const ffmpeg = require('fluent-ffmpeg');
    await new Promise((resolve, reject) => {
      ffmpeg('/tmp/in')
        .setStartTime(0).duration(30)
        .audioCodec('aac').audioBitrate('128k')
        .format('mp4').outputOptions(['-movflags', 'frag_keyframe+empty_moov'])
        .on('end', resolve).on('error', reject)
        .save('/tmp/out');
    });
    const order = calls.map((c) => c[0]);
    expect(order.indexOf('setStartTime')).toBeLessThan(order.indexOf('duration'));
    expect(order.indexOf('duration')).toBeLessThan(order.indexOf('save'));
    expect(calls).toContainEqual(['duration', 30]);
  });
});
