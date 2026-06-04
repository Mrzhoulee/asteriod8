/**
 * SCENE 3 (6.0–10.0s) — THE PEAK. The spotlight shatters and the whole field
 * ignites in a shockwave from centre out (the wave itself is driven by the
 * director so each point lights by its radius). Expanding rings sell the blast;
 * the headline punches in with an overshoot.
 */
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SpotlightCone } from "./parts/SpotlightCone";
import { KineticText } from "../ui/KineticText";
import { useLayout } from "../../config/layout";
import { COLORS, FONTS, TRACKING, TYPE } from "../../config/theme";
import { COPY } from "../../config/copy";
import { sceneById } from "../../config/timings";
import { fadeInOut } from "../../lib/anim";
import { bump } from "../../lib/math";

/** One expanding shockwave ring. */
const ShockRing: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const maxDim = Math.max(width, height);

  const p = interpolate(frame, [5 + delay, 70 + delay], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  if (p <= 0 || p >= 1) return null;

  const size = p * maxDim * 1.8;
  const opacity = bump(p) * 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        border: `${Math.max(2, height * 0.004)}px solid rgba(255,205,150,${opacity})`,
        boxShadow: `0 0 ${height * 0.03}px rgba(255,179,71,${opacity * 0.8})`,
        filter: "blur(1px)",
        opacity,
        mixBlendMode: "screen",
      }}
    />
  );
};

export const Scene03Ignition: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const s3 = sceneById("s3");

  // Headline punches in once the wave is underway, then holds.
  const textOpacity = fadeInOut(frame, s3.duration, 4, 18);

  return (
    <AbsoluteFill>
      {/* The dying spotlight, continuing from scene 2. */}
      <SpotlightCone from={s3.from} />

      {/* Shockwave rings radiating from the ignition. */}
      <ShockRing delay={0} />
      <ShockRing delay={12} />

      <AbsoluteFill
        style={{
          opacity: textOpacity,
          justifyContent: "center",
          alignItems: "center",
          paddingInline: layout.vw * 7,
        }}
      >
        <KineticText
          text={COPY.s3}
          preset="overshoot"
          startFrame={22}
          stagger={2}
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 700,
            color: COLORS.white,
            fontSize: layout.vmin * TYPE.hero,
            lineHeight: 0.98,
            letterSpacing: TRACKING.tight,
            textAlign: "center",
            maxWidth: layout.vw * layout.pick(90, 70),
            textShadow: "0 0 40px rgba(255,179,71,0.45), 0 0 18px rgba(61,215,255,0.3)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
