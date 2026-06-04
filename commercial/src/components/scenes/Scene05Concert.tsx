/**
 * SCENE 5 (14.0–17.0s) — Energy shift to a live show. The field coalesces into
 * a crowd of light (director-driven). A warm stage glow rises, an equalizer
 * punches on the beat, and the whole frame shakes on each hit.
 *
 * Tempo: 120 BPM → a beat every 15 frames. This scene starts on frame 420
 * (a downbeat), so the BEAT HITS land on local frames 0, 15, 30, 45, 60, 75
 * (absolute 420, 435, 450, 465, 480, 495).
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { KineticText } from "../ui/KineticText";
import { useLayout } from "../../config/layout";
import { COLORS, FONTS, TRACKING, TYPE } from "../../config/theme";
import { COPY } from "../../config/copy";
import { sceneById } from "../../config/timings";
import { fadeInOut } from "../../lib/anim";
import { beatEnvelope, beatIndex, beatShakeDir } from "../../lib/beat";

const Equalizer: React.FC<{ beat: number; reveal: number }> = ({ beat, reveal }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const count = layout.pick(13, 23);
  const bars = Array.from({ length: count }, (_, i) => i);
  const baseH = layout.vmin * 6;

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: layout.vmin * 0.9,
        paddingBottom: layout.vh * layout.pick(20, 16),
      }}
    >
      {bars.map((i) => {
        // Each bar has its own idle wiggle; the beat envelope punches them all.
        const wiggle = Math.abs(Math.sin(frame * 0.16 + i * 0.55));
        const height = (baseH * (0.35 + 0.65 * wiggle) + beat * layout.vmin * 9) * reveal;
        return (
          <div
            key={i}
            style={{
              width: layout.vmin * 1.5,
              height,
              borderRadius: 999,
              background: "linear-gradient(to top, #FF8A3D 0%, #FFB347 55%, #FFE9C7 100%)",
              boxShadow: `0 0 ${layout.vmin * 1.6}px rgba(255,150,80,0.6)`,
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Scene05Concert: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const s5 = sceneById("s5");
  const opacity = fadeInOut(frame, s5.duration, 12, 14);

  // Beat envelope (local frame is beat-aligned because the scene starts on a
  // downbeat). Drives the EQ punch, the stage-glow pulse and the screen-shake.
  const beat = beatEnvelope(frame);
  const reveal = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── SCREEN SHAKE on the beat hits ──
  const dir = beatShakeDir(beatIndex(frame + s5.from));
  const shakeAmp = beat * layout.vmin * 1.1;
  const shake = `translate(${dir.x * shakeAmp}px, ${dir.y * shakeAmp}px)`;

  return (
    <AbsoluteFill style={{ opacity, transform: shake }}>
      {/* Warm stage glow rising from the floor, pulsing with the beat. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 75% at 50% 102%, rgba(255,150,80,0.4) 0%, rgba(255,120,60,0) 60%)",
          opacity: (0.7 + beat * 0.3) * reveal,
          mixBlendMode: "screen",
        }}
      />

      <Equalizer beat={beat} reveal={reveal} />

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: layout.vh * layout.pick(20, 13),
          paddingInline: layout.vw * 7,
        }}
      >
        <KineticText
          text={COPY.s5}
          preset="rise"
          startFrame={8}
          stagger={1.6}
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 700,
            color: COLORS.white,
            fontSize: layout.vmin * TYPE.headline,
            lineHeight: 1.0,
            letterSpacing: TRACKING.tight,
            textAlign: "center",
            maxWidth: layout.vw * layout.pick(86, 66),
            textShadow: "0 0 34px rgba(255,150,80,0.5)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
