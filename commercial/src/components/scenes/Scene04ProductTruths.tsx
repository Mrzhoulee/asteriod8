/**
 * SCENE 4 (10.0–14.0s) — Three product truths as kinetic type cards, each with
 * its own micro-animation: "No ads." (rise) / "No algorithms." (flip) /
 * "Equal discovery." (scale-blur). A dark scrim dims the field so type pops; a
 * 3-dot indicator tracks progress.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KineticText, type KineticPreset } from "../ui/KineticText";
import { useLayout } from "../../config/layout";
import { ACCENT, COLORS, FONTS, TRACKING, TYPE } from "../../config/theme";
import { COPY } from "../../config/copy";
import { sceneById } from "../../config/timings";
import { fadeInOut } from "../../lib/anim";
import { clamp } from "../../lib/math";

const PRESETS: KineticPreset[] = ["rise", "flip", "scaleBlur"];

const TruthCard: React.FC<{
  index: string;
  text: string;
  preset: KineticPreset;
  duration: number;
}> = ({ index, text, preset, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();
  const opacity = fadeInOut(frame, duration, 6, 10);

  // Index label slides up + fades in.
  const labelIn = interpolate(frame, [2, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Accent underline wipes out from the centre.
  const underline = spring({
    frame: frame - 10,
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 110 },
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: layout.vmin * 2.2,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.body,
          fontWeight: 600,
          fontSize: layout.vmin * TYPE.label,
          letterSpacing: TRACKING.wide,
          color: ACCENT,
          opacity: labelIn,
          transform: `translateY(${(1 - labelIn) * 18}px)`,
        }}
      >
        {index} — TRUTH
      </div>

      <KineticText
        text={text}
        preset={preset}
        startFrame={6}
        stagger={preset === "flip" ? 2.6 : 2}
        style={{
          fontFamily: FONTS.headline,
          fontWeight: 700,
          color: COLORS.white,
          fontSize: layout.vmin * TYPE.hero,
          lineHeight: 0.98,
          letterSpacing: TRACKING.tight,
          textAlign: "center",
          maxWidth: layout.vw * layout.pick(90, 72),
        }}
      />

      <div
        style={{
          width: layout.vmin * 16,
          height: Math.max(3, layout.vmin * 0.5),
          borderRadius: 999,
          background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.violet})`,
          transform: `scaleX(${clamp(underline)})`,
          boxShadow: `0 0 ${layout.vmin * 2}px rgba(61,215,255,0.5)`,
        }}
      />
    </AbsoluteFill>
  );
};

const ProgressDots: React.FC<{ active: number }> = ({ active }) => {
  const layout = useLayout();
  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "flex-end",
        paddingBottom: layout.vh * layout.pick(12, 9),
        gap: layout.vmin * 1.4,
      }}
    >
      {COPY.truths.map((t, i) => (
        <div
          key={t.index}
          style={{
            width: layout.vmin * (i === active ? 3.4 : 1.2),
            height: layout.vmin * 1.2,
            borderRadius: 999,
            background: i === active ? ACCENT : "rgba(147,160,184,0.4)",
            transition: "none",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

export const Scene04ProductTruths: React.FC = () => {
  const frame = useCurrentFrame();
  const s4 = sceneById("s4");
  const cardDuration = Math.floor(s4.duration / COPY.truths.length);

  const scrim = interpolate(
    frame,
    [0, 12, s4.duration - 12, s4.duration],
    [0, 0.55, 0.55, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const active = clamp(Math.floor(frame / cardDuration), 0, COPY.truths.length - 1);

  return (
    <AbsoluteFill>
      {/* Dim the field so the type reads. */}
      <AbsoluteFill style={{ backgroundColor: `rgba(5,6,10,${scrim})` }} />

      {COPY.truths.map((t, i) => (
        <Sequence key={t.index} from={i * cardDuration} durationInFrames={cardDuration}>
          <TruthCard
            index={t.index}
            text={t.text}
            preset={PRESETS[i % PRESETS.length]}
            duration={cardDuration}
          />
        </Sequence>
      ))}

      <ProgressDots active={active} />
    </AbsoluteFill>
  );
};
