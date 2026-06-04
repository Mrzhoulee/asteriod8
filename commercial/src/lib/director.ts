/**
 * THE DIRECTOR.
 *
 * The asteroid field is one continuous element that lives for the whole 20s.
 * Rather than fade it between scenes (which would flash the void), we drive its
 * state from the absolute frame here. Each scene's foreground (text, cones,
 * flares) sits on top in its own <Sequence>. This is what gives the spot its
 * seamless, single-take feel while still keeping everything componentised.
 *
 * Pure function of (frame, fps) → deterministic, render-safe.
 */
import { Easing, interpolate, spring } from "remotion";
import { CUES } from "../config/timings";
import { beatEnvelope } from "./beat";
import { bump, clamp, lerp } from "./math";

export interface FieldState {
  /** Camera zoom: 2.2 (on the hero) → 1.0 (full field) → slight push-in. */
  zoom: number;
  /** Normalised parallax offset; layers translate by this × their depth. */
  cameraX: number;
  cameraY: number;
  /** Inside-out reveal of the field, 0 (hero only) → 1 (all). */
  reveal: number;
  /** Unfair spotlight strength, 0 → 1 → 0 (shatter). */
  spotlight: number;
  /** Ignition shockwave front, 0 → 1 (then stays lit). */
  ignite: number;
  /** Coalesce into the concert crowd, 0 → 1. */
  concert: number;
  /** Collapse into the logo, 0 → 1. */
  converge: number;
  /** Global warmth pushed into the palette (concert + converge). */
  warmthBoost: number;
  /** Master field opacity (fade up from void, fade down into logo). */
  fieldOpacity: number;
  /** One-shot white bloom (ignition peak + logo reveal). */
  flash: number;
  /** Current beat envelope (0..1) for crowd bounce + jitter. */
  beat: number;
}

const cubicOut = Easing.out(Easing.cubic);
const cubicInOut = Easing.inOut(Easing.cubic);
const cubicIn = Easing.in(Easing.cubic);

/** interpolate() with clamped extrapolation + an optional easing. */
const seg = (
  frame: number,
  range: readonly number[],
  output: readonly number[],
  easing?: (t: number) => number,
): number =>
  interpolate(frame, [...range], [...output], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    ...(easing ? { easing } : {}),
  });

export const directField = (frame: number, fps: number): FieldState => {
  const t = frame / fps;

  // ── ZOOM ───────────────────────────────────────────────────────────────
  // Slow drift while we sit on the hero, then a spring-loaded pull-back as the
  // field is revealed, gentle breathing through the middle, and a soft push-in
  // as everything converges onto the logo.
  let zoom: number;
  if (frame < CUES.pullBackStart) {
    zoom = seg(frame, [0, CUES.pullBackStart], [2.2, 1.9], cubicOut);
  } else {
    const pull = spring({
      frame: frame - CUES.pullBackStart,
      fps,
      config: { damping: 18, mass: 1.1, stiffness: 46 },
    });
    zoom = lerp(1.9, 1.0, pull);
  }
  zoom += Math.sin(t * 0.5) * 0.012; // breathing
  zoom += seg(frame, [CUES.converge[0], CUES.converge[1]], [0, 0.14], cubicInOut);

  // ── REVEAL ─────────────────────────────────────────────────────────────
  const reveal = seg(frame, [CUES.reveal[0], CUES.reveal[1]], [0, 1], cubicOut);

  // ── SPOTLIGHT ──────────────────────────────────────────────────────────
  const spotIn = seg(frame, [CUES.spotlightIn[0], CUES.spotlightIn[1]], [0, 1], cubicOut);
  const spotOut = seg(frame, [CUES.spotlightOut[0], CUES.spotlightOut[1]], [0, 1], cubicInOut);
  const spotlight = clamp(spotIn - spotOut);

  // ── IGNITION ───────────────────────────────────────────────────────────
  const ignite = seg(frame, [CUES.igniteWave[0], CUES.igniteWave[1]], [0, 1], cubicOut);

  // ── CONCERT ────────────────────────────────────────────────────────────
  const concert =
    frame < CUES.concertIn
      ? 0
      : spring({
          frame: frame - CUES.concertIn,
          fps,
          config: { damping: 15, mass: 1, stiffness: 55 },
        });

  // ── CONVERGE ───────────────────────────────────────────────────────────
  const converge = seg(frame, [CUES.converge[0], CUES.converge[1]], [0, 1], cubicIn);

  // ── OPACITY / FLASH ────────────────────────────────────────────────────
  const fadeIn = seg(frame, [CUES.fieldFadeIn[0], CUES.fieldFadeIn[1]], [0, 1], cubicOut);
  const fieldOpacity = fadeIn * (1 - converge * 0.82);

  const igniteFlash = bump(seg(frame, [CUES.igniteFlash[0], CUES.igniteFlash[1]], [0, 1]));
  const logoFlash = bump(seg(frame, [CUES.logoFlash[0], CUES.logoFlash[1]], [0, 1]));
  const flash = clamp(igniteFlash * 0.95 + logoFlash * 0.55);

  // ── BEAT + CAMERA LIFE ─────────────────────────────────────────────────
  const beat = beatEnvelope(frame);
  let cameraX = Math.sin(t * 0.18) * 0.05 + Math.cos(t * 0.07) * 0.025;
  let cameraY = Math.cos(t * 0.15) * 0.035;
  cameraX += Math.sin(t * 0.9) * 0.01;
  cameraY += beat * concert * 0.012; // crowd jitter on the beat

  const warmthBoost = clamp(concert * 0.85 + converge * 0.6);

  return {
    zoom,
    cameraX,
    cameraY,
    reveal,
    spotlight,
    ignite,
    concert,
    converge,
    warmthBoost,
    fieldOpacity,
    flash,
    beat,
  };
};
