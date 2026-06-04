/**
 * Tiny, dependency-free math helpers used across the particle system and the
 * motion director. Everything here is pure so renders stay deterministic.
 */

export const TAU = Math.PI * 2;

/** Clamp a value into a range (defaults to the 0..1 unit range). */
export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

/** Linear interpolation between a and b. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Inverse lerp — where does `value` sit between a and b (clamped 0..1). */
export const invLerp = (a: number, b: number, value: number): number =>
  a === b ? 0 : clamp((value - a) / (b - a));

/** Smooth Hermite interpolation between two edges. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = invLerp(edge0, edge1, x);
  return t * t * (3 - 2 * t);
};

/** Wrap a value into the [min, max) interval (used for looping drift). */
export const wrap = (value: number, min: number, max: number): number => {
  const span = max - min;
  return ((((value - min) % span) + span) % span) + min;
};

/**
 * A 0 → 1 → 0 "bump" curve. Great for shockwave crests and one-shot flashes.
 * Input is clamped to 0..1.
 */
export const bump = (x: number): number => Math.sin(clamp(x) * Math.PI);

/** Distance between two points. */
export const dist = (x0: number, y0: number, x1: number, y1: number): number =>
  Math.hypot(x1 - x0, y1 - y0);
