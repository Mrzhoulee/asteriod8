/**
 * Beat-grid helpers for the implied 120 BPM tempo.
 * At 30fps that's a beat every 15 frames (FRAMES_PER_BEAT).
 */
import { random } from "remotion";
import { FRAMES_PER_BEAT } from "../config/timings";

/**
 * A percussive 0..1 envelope that spikes on every beat and decays before the
 * next one — the heartbeat behind scene 5's pulses and screen-shake.
 * `decay` controls how snappy the falloff is.
 */
export const beatEnvelope = (
  frame: number,
  framesPerBeat: number = FRAMES_PER_BEAT,
  decay = 6,
): number => {
  const phase = (((frame % framesPerBeat) + framesPerBeat) % framesPerBeat) / framesPerBeat;
  return Math.exp(-phase * decay);
};

/** Which beat are we on (integer index from frame 0). */
export const beatIndex = (
  frame: number,
  framesPerBeat: number = FRAMES_PER_BEAT,
): number => Math.floor(frame / framesPerBeat);

/**
 * A stable, seeded shake direction for a given beat so screen-shake feels
 * organic but renders identically every time.
 */
export const beatShakeDir = (index: number): { x: number; y: number } => ({
  x: random(`beat-x-${index}`) * 2 - 1,
  y: random(`beat-y-${index}`) * 2 - 1,
});
