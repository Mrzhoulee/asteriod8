/**
 * <FilmGrain> — animated monochrome grain via an SVG turbulence filter.
 * Re-seeded each frame so it shimmers like real film. Kept very subtle and on
 * `overlay` so it adds texture without muddying the colours.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  // Cycle the seed so the grain moves but stays deterministic.
  const seed = frame % 100;

  return (
    <AbsoluteFill
      style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}
    >
      <svg width="100%" height="100%">
        <filter id="film-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
