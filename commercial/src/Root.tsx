/**
 * The Remotion root — registers both deliverables. They share the exact same
 * component (AsteroidCommercial); only the canvas dimensions differ, and every
 * layer adapts its layout to the orientation.
 */
import React from "react";
import { Composition } from "remotion";
import { AsteroidCommercial } from "./components/Composition";
import { DURATION_IN_FRAMES, FORMATS, FPS } from "./config/timings";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Vertical — 1080×1920 for TikTok / Instagram Reels. */}
      <Composition
        id="AsteroidVertical"
        component={AsteroidCommercial}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={FORMATS.vertical.width}
        height={FORMATS.vertical.height}
      />

      {/* Horizontal — 1920×1080 for YouTube / landscape. */}
      <Composition
        id="AsteroidHorizontal"
        component={AsteroidCommercial}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={FORMATS.horizontal.width}
        height={FORMATS.horizontal.height}
      />
    </>
  );
};
