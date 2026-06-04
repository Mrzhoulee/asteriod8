/**
 * SCENE 1 (0.0–3.0s) — Black void. The hero point (rendered by the continuous
 * field) drifts in and pulses. A tiny kinetic caption fades up.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { KineticText } from "../ui/KineticText";
import { useLayout } from "../../config/layout";
import { COLORS, FONTS, TRACKING, TYPE } from "../../config/theme";
import { COPY } from "../../config/copy";
import { sceneById } from "../../config/timings";
import { fadeInOut } from "../../lib/anim";

export const Scene01SinglePoint: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const opacity = fadeInOut(frame, sceneById("s1").duration, 12, 16);

  return (
    <AbsoluteFill
      style={{
        opacity,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: layout.vh * layout.pick(24, 17),
      }}
    >
      <KineticText
        text={COPY.s1}
        preset="rise"
        startFrame={16}
        stagger={2.4}
        style={{
          fontFamily: FONTS.body,
          fontWeight: 500,
          color: COLORS.white,
          fontSize: layout.vmin * TYPE.small,
          letterSpacing: TRACKING.snug,
          textAlign: "center",
          maxWidth: layout.vw * 86,
          textShadow: "0 0 26px rgba(61,215,255,0.28)",
        }}
      />
    </AbsoluteFill>
  );
};
