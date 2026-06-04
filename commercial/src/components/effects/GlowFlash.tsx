/**
 * <GlowFlash> — a global one-shot white bloom driven by the director's `flash`
 * value (ignition peak + logo reveal). Screen-blended so it blooms the frame
 * rather than washing it flat.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { directField } from "../../lib/director";

export const GlowFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { flash } = directField(frame, fps);
  if (flash <= 0.001) return null;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: flash,
        background:
          "radial-gradient(60% 50% at 50% 50%, rgba(255,234,200,0.9) 0%, rgba(139,92,255,0.25) 35%, rgba(5,6,10,0) 70%)",
      }}
    />
  );
};
