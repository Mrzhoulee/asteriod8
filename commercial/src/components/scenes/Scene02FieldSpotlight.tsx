/**
 * SCENE 2 (3.0–6.0s) — Camera pulls back to reveal the vast field (handled by
 * the director). A harsh spotlight sweeps in and isolates only a few points;
 * everything else is crushed into the cold dark. Feels unfair.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SpotlightCone } from "./parts/SpotlightCone";
import { KineticText } from "../ui/KineticText";
import { useLayout } from "../../config/layout";
import { COLORS, FONTS, TRACKING, TYPE } from "../../config/theme";
import { COPY } from "../../config/copy";
import { sceneById } from "../../config/timings";
import { fadeInOut } from "../../lib/anim";

export const Scene02FieldSpotlight: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const s2 = sceneById("s2");
  const opacity = fadeInOut(frame, s2.duration, 12, 14);

  return (
    <AbsoluteFill>
      <SpotlightCone from={s2.from} />
      <AbsoluteFill
        style={{
          opacity,
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: layout.vh * layout.pick(15, 11),
          paddingInline: layout.vw * 8,
        }}
      >
        <KineticText
          text={COPY.s2}
          preset="rise"
          startFrame={22}
          stagger={1.1}
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 500,
            color: COLORS.textDim,
            fontSize: layout.vmin * TYPE.headline,
            lineHeight: 1.04,
            letterSpacing: TRACKING.snug,
            textAlign: "center",
            maxWidth: layout.vw * layout.pick(84, 64),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
