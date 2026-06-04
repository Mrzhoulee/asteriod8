/**
 * <ParticleField> — renders the deterministic asteroid field every frame.
 *
 * One continuous layer for the whole spot. All behaviour is driven by the
 * motion director (see lib/director.ts) so it flows across scene cuts. Each
 * point is a single GPU-friendly div (transform + opacity only) using a
 * `screen` blend so overlapping glows bloom additively on the black void.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ARTIST_GRADIENT, RGB_AMBER } from "../../config/theme";
import { mixRgb, rgba, sampleGradient } from "../../lib/color";
import { directField, type FieldState } from "../../lib/director";
import { clamp, lerp, TAU, wrap } from "../../lib/math";
import {
  FIELD_MAX_R,
  PARTICLES,
  type Particle,
} from "../../lib/particles";

// Tunables for the field's look.
const SIZE_MIN = 7; // glow diameter (px) for far points at zoom 1
const SIZE_MAX = 22; // glow diameter (px) for near points
const DIM_FIELD = 0.62; // resting brightness of the un-ignited field
const REVEAL_EDGE = 0.22; // softness of the inside-out reveal front
const IGNITE_EDGE = 0.3; // width of the ignition shockwave crest

interface ProjectCtx {
  width: number;
  height: number;
  t: number; // seconds (absolute)
  s: FieldState;
}

interface Projected {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
}

/** Project one particle to screen space + resolve its colour/brightness. */
const project = (p: Particle, ctx: ProjectCtx): Projected => {
  const { width, height, t, s } = ctx;
  const spread = Math.max(width, height) * 0.58;

  // Continuous drift, wrapped so the field loops seamlessly.
  let nx = wrap(p.x + p.driftX * t, -1.25, 1.25);
  let ny = wrap(p.y + p.driftY * t, -1.25, 1.25);

  // Coalesce into the concert crowd (lower-middle band, bouncing on the beat).
  if (s.concert > 0) {
    const bounce = Math.sin(t * TAU * 2 + p.crowdPhase) * 0.01 + s.beat * 0.02 * s.concert;
    nx = lerp(nx, p.crowdX, s.concert);
    ny = lerp(ny, p.crowdY - bounce, s.concert);
  }

  // Converge into the logo at the very end.
  if (s.converge > 0) {
    nx = lerp(nx, 0, s.converge);
    ny = lerp(ny, 0, s.converge * 0.85);
  }

  // Project with depth-based parallax (near layers move more than far ones).
  const depth = p.z - 0.5;
  const x = width / 2 + (nx * spread + s.cameraX * width * depth) * s.zoom;
  const y = height / 2 + (ny * spread + s.cameraY * height * depth) * s.zoom;

  // ── Brightness ──────────────────────────────────────────────────────────
  // Per-point twinkle.
  let b = 0.55 + 0.45 * Math.sin(p.twPhase + t * p.twFreq * TAU);

  // Inside-out reveal: a point lights only once the reveal front passes its r.
  // The hero point (id 0) is the single light in scene 1, so it's always lit.
  const revealFront = s.reveal * (FIELD_MAX_R + REVEAL_EDGE);
  const revealAlpha = p.id === 0 ? 1 : clamp((revealFront - p.r) / REVEAL_EDGE);
  b *= revealAlpha;

  let intensity = b * DIM_FIELD;

  // Unfair spotlight: picks flare bright while everyone else is held in a cold,
  // dim floor — present but ignored. That contrast IS the point of the scene.
  if (s.spotlight > 0) {
    intensity *= p.spot ? lerp(1, 1.6, s.spotlight) : lerp(1, 0.14, s.spotlight);
  }

  // Ignition shockwave: delay each point by its radius so it reads as a real
  // front expanding from centre. The crest is the bright leading edge.
  const igniteFront = s.ignite * (FIELD_MAX_R + IGNITE_EDGE);
  const ig = clamp((igniteFront - p.r) / IGNITE_EDGE);
  const crest = ig * (1 - ig) * 4; // peaks at the moving front, 0 elsewhere
  if (s.ignite > 0) {
    intensity = lerp(intensity, 1, ig * ig); // ignited points stay fully lit
  }
  intensity = clamp(intensity + crest * 0.5);

  // ── Size ────────────────────────────────────────────────────────────────
  let size = lerp(SIZE_MIN, SIZE_MAX, p.z) * s.zoom;
  size *= 1 + crest * 0.8 + s.beat * s.concert * 0.5 * (0.5 + p.z);

  // ── Colour ──────────────────────────────────────────────────────────────
  // Cool resting palette; warmth pushed by the shockwave crest, concert + logo.
  const warmth = clamp(crest * 0.9 + s.warmthBoost);
  const color = mixRgb(sampleGradient(ARTIST_GRADIENT, p.hue), RGB_AMBER, warmth);

  return {
    x,
    y,
    size,
    alpha: clamp(intensity),
    // Bright core → soft transparent edge gives a built-in bloom.
    color: `radial-gradient(circle, ${rgba(color, 1)} 0%, ${rgba(
      color,
      0.55,
    )} 24%, ${rgba(color, 0)} 70%)`,
  };
};

export const ParticleField: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const s = directField(frame, fps);
  const ctx: ProjectCtx = { width, height, t: frame / fps, s };

  return (
    <AbsoluteFill style={{ opacity: s.fieldOpacity, isolation: "isolate" }}>
      {PARTICLES.map((p) => {
        const v = project(p, ctx);
        // Skip points that aren't contributing — keeps scene 1 (one point) and
        // the dim passages cheap to render.
        if (v.alpha < 0.012) return null;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: v.size,
              height: v.size,
              borderRadius: "50%",
              background: v.color,
              opacity: v.alpha,
              transform: `translate3d(${v.x}px, ${v.y}px, 0) translate(-50%, -50%)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
