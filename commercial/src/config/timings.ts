/**
 * TIMINGS — the master timeline. All frame numbers live here so the spot can be
 * re-paced without touching component code.
 *
 * 30fps · 20 seconds · 600 frames total.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

/** The two deliverables share every scene component; only the canvas changes. */
export const FORMATS = {
  vertical: { width: 1080, height: 1920 }, // TikTok / Reels
  horizontal: { width: 1920, height: 1080 }, // YouTube / landscape
} as const;

/** Implied tempo for beat-synced motion (scene 5 pulses + shakes). */
export const BPM = 120;
/** 120 BPM @ 30fps → a beat every 15 frames (0.5s). */
export const FRAMES_PER_BEAT = (FPS * 60) / BPM;

export type SceneId = "s1" | "s2" | "s3" | "s4" | "s5" | "s6";

export interface SceneTiming {
  id: SceneId;
  name: string;
  from: number;
  duration: number;
}

/**
 * Scene boundaries on the master timeline. Each scene's foreground lives in a
 * <Sequence> starting at `from`. The continuous particle field underneath reads
 * the absolute frame so motion flows seamlessly across these cuts.
 */
export const SCENES: SceneTiming[] = [
  { id: "s1", name: "Single Point", from: 0, duration: 90 }, //  0.0–3.0s
  { id: "s2", name: "Field & Spotlight", from: 90, duration: 90 }, //  3.0–6.0s
  { id: "s3", name: "Ignition", from: 180, duration: 120 }, //  6.0–10.0s
  { id: "s4", name: "Product Truths", from: 300, duration: 120 }, // 10.0–14.0s
  { id: "s5", name: "Concert", from: 420, duration: 90 }, // 14.0–17.0s
  { id: "s6", name: "Logo", from: 510, duration: 90 }, // 17.0–20.0s
];

export const sceneById = (id: SceneId): SceneTiming => {
  const scene = SCENES.find((s) => s.id === id);
  if (!scene) throw new Error(`Unknown scene: ${id}`);
  return scene;
};

/**
 * DIRECTOR CUES — keyframes (in absolute frames) that drive the shared field
 * state. Centralised so the field, scene overlays and music stay in lock-step.
 */
export const CUES = {
  /** Hero point fades up out of the void. */
  fieldFadeIn: [0, 26] as const,
  /** Camera pulls back, zoom 1.9 → 1.0 (spring starts here). */
  pullBackStart: 90,
  /** Inside-out reveal of the full field (lands before the spotlight bites). */
  reveal: [92, 146] as const,
  /** Harsh spotlight sweeps in and isolates a few points. */
  spotlightIn: [134, 172] as const,
  /** The spotlight shatters. */
  spotlightOut: [182, 202] as const,
  /** Ignition shockwave propagates from centre. */
  igniteWave: [185, 258] as const,
  /** White bloom at the ignition peak. */
  igniteFlash: [183, 214] as const,
  /** Field coalesces into the concert crowd. */
  concertIn: 418,
  /** Everything converges into the logo. */
  converge: [508, 590] as const,
  /** Soft flash behind the logo reveal. */
  logoFlash: [536, 576] as const,
} as const;
