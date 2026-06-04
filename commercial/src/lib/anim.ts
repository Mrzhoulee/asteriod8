/**
 * Shared frame-based animation helpers for scene foregrounds.
 */
import { interpolate } from "remotion";

/**
 * A clean fade-in / hold / fade-out envelope across a scene's local duration.
 * Keeps scene hand-offs smooth without flashing the void underneath.
 */
export const fadeInOut = (
  frame: number,
  durationInFrames: number,
  fadeIn = 10,
  fadeOut = 12,
): number =>
  interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
