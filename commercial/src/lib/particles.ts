/**
 * The asteroid field — a deterministic particle system.
 *
 * Each point is an independent artist. Positions, depth, colour, drift and
 * twinkle are all generated once from a fixed seed (via Remotion's `random`),
 * so the field is byte-for-byte reproducible across every render and identical
 * in both the vertical and horizontal compositions.
 *
 * Coordinates are normalised and aspect-independent (roughly -1..1 around the
 * centre); the <ParticleField> projects them to pixels per canvas.
 */
import { random } from "remotion";
import { TAU } from "./math";

export interface Particle {
  id: number;
  /** Normalised position (≈ -1..1). */
  x: number;
  y: number;
  /** Depth 0 (far/small) → 1 (near/large), drives parallax + size. */
  z: number;
  /** Gradient parameter 0..1 across the cool→warm artist palette. */
  hue: number;
  /** Per-second normalised drift velocity. */
  driftX: number;
  driftY: number;
  /** Twinkle oscillation phase + frequency. */
  twPhase: number;
  twFreq: number;
  /** Radius from centre — used for the inside-out reveal + ignition delay. */
  r: number;
  /** One of the handful of points the unfair spotlight picks out. */
  spot: boolean;
  /** Target position when the field coalesces into the concert crowd. */
  crowdX: number;
  crowdY: number;
  /** Per-particle phase for the crowd's beat bounce. */
  crowdPhase: number;
}

export const PARTICLE_COUNT = 400;

const FIELD = {
  discRadius: 1.0, // the normalised radius the field fills
  driftSpeed: 0.014, // slow continuous drift (units / second)
} as const;

/** The 4 points the harsh spotlight isolates — a tight off-centre cluster. */
const SPOTLIGHT_PICKS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: 0.14, y: 0.02, z: 0.62 },
  { x: 0.27, y: -0.07, z: 0.7 },
  { x: 0.08, y: 0.13, z: 0.55 },
  { x: 0.33, y: 0.09, z: 0.66 },
];

/** Centroid of the picks, so scene 2 can aim its cone at them. */
export const SPOTLIGHT_TARGET = {
  x: SPOTLIGHT_PICKS.reduce((s, p) => s + p.x, 0) / SPOTLIGHT_PICKS.length,
  y: SPOTLIGHT_PICKS.reduce((s, p) => s + p.y, 0) / SPOTLIGHT_PICKS.length,
};

const generateField = (count: number): Particle[] => {
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    let z: number;
    let spot = false;

    if (i === 0) {
      // The hero point — dead centre, near, bright. This is the single dim
      // light in scene 1 that the whole field grows out of.
      x = 0;
      y = 0;
      z = 0.92;
    } else if (i <= SPOTLIGHT_PICKS.length) {
      const pick = SPOTLIGHT_PICKS[i - 1];
      x = pick.x;
      y = pick.y;
      z = pick.z;
      spot = true;
    } else {
      // Uniform distribution across a disc (sqrt keeps it even, not clumped).
      const radius = Math.sqrt(random(`r-${i}`)) * FIELD.discRadius;
      const angle = random(`a-${i}`) * TAU;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = random(`z-${i}`);
    }

    // Bias hue toward the cool end (cyan/violet); only a few points run warm.
    const hue = random(`h-${i}`) * random(`h2-${i}`);

    const driftAngle = random(`da-${i}`) * TAU;
    const driftSpeed = (0.3 + random(`ds-${i}`) * 0.7) * FIELD.driftSpeed;

    particles.push({
      id: i,
      x,
      y,
      z,
      hue,
      driftX: Math.cos(driftAngle) * driftSpeed,
      driftY: Math.sin(driftAngle) * driftSpeed,
      twPhase: random(`tp-${i}`) * TAU,
      twFreq: 0.15 + random(`tf-${i}`) * 0.5,
      r: Math.hypot(x, y),
      spot,
      // Concert target: keep horizontal spread, settle into a lower-middle band.
      crowdX: x * 0.82,
      crowdY: 0.28 + (random(`cy-${i}`) - 0.5) * 0.24,
      crowdPhase: random(`cp-${i}`) * TAU,
    });
  }

  return particles;
};

/** The field, generated once at module load and shared everywhere. */
export const PARTICLES: Particle[] = generateField(PARTICLE_COUNT);

/** Largest radius in the field — the ignition wave + reveal normalise to this. */
export const FIELD_MAX_R = PARTICLES.reduce((m, p) => Math.max(m, p.r), 0);
