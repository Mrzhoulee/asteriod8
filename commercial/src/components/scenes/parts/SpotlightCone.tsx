/**
 * <SpotlightCone> — the harsh, cold beam that singles out a few artists.
 *
 * Shared by scene 2 (sweeps in + holds) and scene 3 (dissolves/shatters). It
 * reads the director's `spotlight` value off the ABSOLUTE frame so it appears,
 * aims at the picked cluster, and shatters in perfect sync with the field
 * dimming the un-picked points. Pass the scene's `from` so local→absolute.
 */
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { directField } from "../../../lib/director";
import { SPOTLIGHT_TARGET } from "../../../lib/particles";
import { CUES } from "../../../config/timings";

export const SpotlightCone: React.FC<{ from: number }> = ({ from }) => {
  const abs = useCurrentFrame() + from;
  const { width, height, fps } = useVideoConfig();
  const s = directField(abs, fps);
  if (s.spotlight <= 0.001) return null;

  // Project the pick cluster the same way the field does, so the beam lands
  // exactly on the lit points as the camera moves.
  const spread = Math.max(width, height) * 0.58;
  const depth = 0.62 - 0.5;
  const tx = width / 2 + (SPOTLIGHT_TARGET.x * spread + s.cameraX * width * depth) * s.zoom;
  const ty = height / 2 + (SPOTLIGHT_TARGET.y * spread + s.cameraY * height * depth) * s.zoom;

  const apexX = width * 0.5;
  const apexY = -height * 0.16;
  const dx = tx - apexX;
  const dy = ty - apexY;
  const aimAngle = (Math.atan2(dx, dy) * 180) / Math.PI;

  // Sweep in with an easing, with a wobble that settles as it locks on.
  const sweep = interpolate(abs, [CUES.spotlightIn[0], CUES.spotlightIn[1]], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  // CSS rotation is clockwise-positive; negate the aim so the beam points AT
  // the cluster. It swings in from the left and locks on as `sweep` → 1.
  const targetAngle = -aimAngle;
  const wobble = Math.sin(abs * 0.6) * 6 * (1 - sweep);
  const angle = 26 * (1 - sweep) + targetAngle * sweep + wobble;

  // Shatter: as the beam dies it blooms apart and blurs out.
  const shatter = interpolate(abs, [CUES.spotlightOut[0], CUES.spotlightOut[1]], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const beamLen = Math.hypot(dx, dy) * 1.3;
  const baseW = width * 0.2 * (1 + shatter * 0.5);
  const opacity = s.spotlight * 0.85;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* The beam itself — a hard, cold cone. */}
      <div
        style={{
          position: "absolute",
          left: apexX,
          top: apexY,
          width: baseW,
          height: beamLen,
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: "50% 0%",
          clipPath: "polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)",
          background:
            "linear-gradient(to bottom, rgba(228,242,255,0.95) 0%, rgba(160,205,255,0.3) 45%, rgba(150,200,255,0) 100%)",
          filter: `blur(${12 + shatter * 28}px)`,
          opacity,
          mixBlendMode: "screen",
        }}
      />
      {/* Cold hotspot where the beam lands. */}
      <div
        style={{
          position: "absolute",
          left: tx,
          top: ty,
          width: height * 0.22,
          height: height * 0.22,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(220,240,255,0.5) 0%, rgba(180,210,255,0) 65%)",
          opacity: opacity * (1 - shatter),
          filter: "blur(6px)",
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
