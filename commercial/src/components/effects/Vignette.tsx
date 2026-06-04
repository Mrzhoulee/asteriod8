/**
 * <Vignette> — soft darkening toward the edges for a cinematic, focused frame.
 */
import React from "react";
import { AbsoluteFill } from "remotion";

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(120% 100% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,${strength}) 100%)`,
      }}
    />
  );
};
