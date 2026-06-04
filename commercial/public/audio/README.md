# Audio

Drop your music track here as `track.mp3` (or `.wav`/`.m4a`), then point
`src/config/audio.ts` at it:

```ts
export const AUDIO = {
  src: "audio/track.mp3", // relative to /public
  volume: 0.9,
  offsetInSeconds: 0,
};
```

The spot is choreographed to an implied **120 BPM** grid — a beat every **15
frames** (0.5s) at 30fps. Beats land on frames `0, 15, 30, 45, …`.

**Scene 5 (concert, frames 420–510)** emphasises the beats at frames
`420, 435, 450, 465, 480, 495` — that's where the equalizer punches and the
screen-shake hits.

Until a file is present, no `<Audio>` is rendered and the project renders
silently (no missing-file error).
