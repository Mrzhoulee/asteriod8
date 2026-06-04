/**
 * AUDIO SLOT configuration.
 *
 * The spot is choreographed to an implied 120 BPM grid (a beat every 15 frames
 * / 0.5s). To drop a real track in:
 *   1. Put your file at `public/audio/track.mp3`
 *   2. Set `src` below to "audio/track.mp3"
 *   3. (Optional) nudge `offsetInSeconds` so the downbeat lands on frame 0.
 *
 * Until then `src` is null and no <Audio> is rendered, so the project renders
 * silently without erroring on a missing file.
 *
 * Beat grid reference (frames): 0, 15, 30, 45, 60 ...
 *   • Scene 5 (concert, frames 420–510) emphasises beats at
 *     420, 435, 450, 465, 480, 495 — that's where the EQ punches and the
 *     screen-shake hits land.
 */
export const AUDIO: {
  src: string | null;
  volume: number;
  offsetInSeconds: number;
} = {
  src: null,
  volume: 0.9,
  offsetInSeconds: 0,
};
