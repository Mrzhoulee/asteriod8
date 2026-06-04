/**
 * SCENE 6 (17.0–20.0s) — Everything converges into the ASTEROID wordmark (the
 * field collapse is director-driven, so the logo literally forms from the
 * asteroid field). A soft anamorphic lens flare sweeps across, the tagline
 * settles, and the end card holds on asteroid8.net.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KineticText } from "../ui/KineticText";
import { useLayout } from "../../config/layout";
import { ACCENT, COLORS, FONTS, TRACKING, TYPE } from "../../config/theme";
import { COPY } from "../../config/copy";
import { clamp } from "../../lib/math";

/** Soft, single-pass anamorphic lens flare centred on the wordmark. */
const LensFlare: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const layout = useLayout();

  const sweep = interpolate(frame, [16, 48], [-0.62, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const intensity = Math.sin(clamp(interpolate(frame, [14, 54], [0, 1])) * Math.PI);
  if (intensity <= 0.001) return null;

  const x = sweep * width;

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}
    >
      {/* Wide low anamorphic streak. */}
      <div
        style={{
          position: "absolute",
          width: "150%",
          height: layout.vmin * 0.9,
          background:
            "linear-gradient(90deg, rgba(61,215,255,0) 0%, rgba(180,230,255,0.9) 50%, rgba(61,215,255,0) 100%)",
          filter: `blur(${layout.vmin * 0.6}px)`,
          opacity: intensity * 0.9,
          transform: `translateX(${x}px)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Bright travelling core + vertical glint. */}
      <div
        style={{
          position: "absolute",
          width: layout.vmin * 5,
          height: layout.vmin * 5,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(180,230,255,0.4) 35%, rgba(61,215,255,0) 70%)",
          opacity: intensity,
          transform: `translateX(${x}px)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: layout.vmin * 0.5,
          height: layout.vmin * 22,
          background:
            "linear-gradient(180deg, rgba(180,230,255,0) 0%, rgba(180,230,255,0.7) 50%, rgba(180,230,255,0) 100%)",
          filter: `blur(${layout.vmin * 0.4}px)`,
          opacity: intensity * 0.8,
          transform: `translateX(${x}px)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

export const Scene06Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();

  // Halo behind the wordmark — the warm core the field collapses into.
  const halo = spring({ frame: frame - 2, fps, config: { damping: 20, mass: 1, stiffness: 70 } });

  // Underline divider wipes in.
  const divider = spring({
    frame: frame - 40,
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 110 },
  });

  const taglineIn = interpolate(frame, [42, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlIn = interpolate(frame, [54, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Convergence halo. */}
      <div
        style={{
          position: "absolute",
          width: layout.vmin * 70,
          height: layout.vmin * 70,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,210,160,0.22) 0%, rgba(61,215,255,0.1) 32%, rgba(5,6,10,0) 62%)",
          opacity: clamp(halo),
          transform: `scale(${0.6 + clamp(halo) * 0.4})`,
          mixBlendMode: "screen",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: layout.vmin * 2.6,
          paddingInline: layout.vw * 6,
        }}
      >
        {/* Wordmark — each glyph carries the cool brand gradient. */}
        <KineticText
          text={COPY.brand}
          preset="overshoot"
          startFrame={12}
          stagger={2.2}
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 700,
            fontSize: layout.vmin * TYPE.wordmark,
            letterSpacing: layout.pick("-0.02em", "-0.01em"),
            textAlign: "center",
            filter: "drop-shadow(0 0 34px rgba(61,215,255,0.5))",
          }}
          charStyle={{
            backgroundImage:
              "linear-gradient(180deg, #F4F8FF 0%, #3DD7FF 52%, #8B5CFF 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
          }}
        />

        {/* Divider. */}
        <div
          style={{
            width: layout.vmin * 22,
            height: Math.max(2, layout.vmin * 0.35),
            borderRadius: 999,
            background: `linear-gradient(90deg, rgba(61,215,255,0) 0%, ${COLORS.cyan} 50%, rgba(61,215,255,0) 100%)`,
            transform: `scaleX(${clamp(divider)})`,
          }}
        />

        {/* Tagline. */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontWeight: 400,
            fontSize: layout.vmin * TYPE.tagline,
            letterSpacing: TRACKING.snug,
            color: COLORS.textDim,
            textAlign: "center",
            opacity: taglineIn,
            transform: `translateY(${(1 - taglineIn) * 14}px)`,
            textShadow: "0 1px 18px rgba(5,6,10,0.9)",
          }}
        >
          {COPY.tagline}
        </div>

        {/* End-card URL. */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontWeight: 600,
            fontSize: layout.vmin * TYPE.label,
            letterSpacing: TRACKING.wide,
            color: ACCENT,
            textAlign: "center",
            opacity: urlIn,
            marginTop: layout.vmin * 1.5,
            textShadow: "0 1px 18px rgba(5,6,10,0.95)",
          }}
        >
          {COPY.url}
        </div>
      </div>

      <LensFlare />
    </AbsoluteFill>
  );
};
