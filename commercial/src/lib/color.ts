/**
 * Minimal RGB colour helpers. We work in plain [r, g, b] tuples so we can mix
 * the brand palette per-particle every frame without allocating heavy objects.
 */
import { clamp, lerp } from "./math";

export type RGB = [number, number, number];

/** Parse a #rrggbb (or #rgb) hex string into an RGB tuple. */
export const hexToRgb = (hex: string): RGB => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

/** Linearly blend two colours. t = 0 returns a, t = 1 returns b. */
export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Sample a multi-stop gradient. `stops` are spaced evenly across 0..1 and `t`
 * is clamped. Used to spread the cool→warm artist palette across the field.
 */
export const sampleGradient = (stops: RGB[], t: number): RGB => {
  if (stops.length === 1) return stops[0];
  const clamped = clamp(t);
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return mixRgb(stops[i], stops[i + 1], scaled - i);
};

/** Build a CSS rgba() string from an RGB tuple + alpha. */
export const rgba = (c: RGB, alpha = 1): string =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${clamp(
    alpha,
    0,
    1,
  )})`;

/** Build a CSS rgb() string from an RGB tuple. */
export const rgb = (c: RGB): string =>
  `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
