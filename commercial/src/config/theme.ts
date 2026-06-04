/**
 * THEME — the single source of truth for colour and type.
 * Tweak the palette here and it propagates through the whole spot.
 */
import { hexToRgb, type RGB } from "../lib/color";
import { FONT_BODY, FONT_HEADLINE } from "../fonts";

/** Brand palette. Deep-space near-black base with a cool→warm artist range. */
export const COLORS = {
  /** Deep space near-black background. */
  bg: "#05060A",
  /** A touch lighter than bg, used for subtle depth gradients. */
  bgLift: "#0A0E1A",
  /** Electric cyan — the cool end of the artist gradient + primary accent. */
  cyan: "#3DD7FF",
  /** Violet — the mid of the artist gradient. */
  violet: "#8B5CFF",
  /** Warm amber — ignition + concert energy. */
  amber: "#FFB347",
  /** Near-white for headlines and the logo core. */
  white: "#F4F8FF",
  /** Muted blue-grey for secondary copy. */
  textDim: "#93A0B8",
} as const;

/** The primary accent used consistently for UI flourishes + the wordmark. */
export const ACCENT = COLORS.cyan;

/** Pre-parsed RGB tuples (parsed once at module load, reused every frame). */
export const RGB_BG: RGB = hexToRgb(COLORS.bg);
export const RGB_CYAN: RGB = hexToRgb(COLORS.cyan);
export const RGB_VIOLET: RGB = hexToRgb(COLORS.violet);
export const RGB_AMBER: RGB = hexToRgb(COLORS.amber);
export const RGB_WHITE: RGB = hexToRgb(COLORS.white);

/**
 * The cool artist gradient sampled per-particle. Mostly cyan→violet with a
 * sliver of amber so the resting field reads cool, with warmth reserved for the
 * ignition and concert beats.
 */
export const ARTIST_GRADIENT: RGB[] = [RGB_CYAN, RGB_VIOLET, RGB_AMBER];

/** Typography. Headlines use a geometric grotesque; body uses a clean sans. */
export const FONTS = {
  headline: FONT_HEADLINE,
  body: FONT_BODY,
} as const;

/**
 * Type scale expressed in `vmin` multiples so headlines fit BOTH the vertical
 * and horizontal compositions without overflowing. Multiply by `layout.vmin`.
 */
export const TYPE = {
  hero: 11, // big punchy headlines (scene 3 / cards)
  headline: 7, // standard scene headlines
  small: 3.4, // kinetic captions
  label: 2.1, // index labels / url
  wordmark: 13, // the ASTEROID logo
  tagline: 3.0,
} as const;

/** Shared letter-spacing values. Tight tracking on the big stuff. */
export const TRACKING = {
  tight: "-0.04em",
  snug: "-0.02em",
  wide: "0.22em",
} as const;
