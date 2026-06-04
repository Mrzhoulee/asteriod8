/**
 * <Background> — the deep-space void the whole spot sits on.
 * A near-black base with a barely-there centre lift + cool nebula tint so the
 * dark never reads as a flat black rectangle.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../../config/theme";

export const Background: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Subtle vertical depth + a faint cool glow toward upper-centre. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 38%, ${COLORS.bgLift} 0%, ${COLORS.bg} 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(60% 50% at 70% 18%, rgba(61,215,255,0.06) 0%, rgba(5,6,10,0) 60%)",
        }}
      />
    </AbsoluteFill>
  );
};
