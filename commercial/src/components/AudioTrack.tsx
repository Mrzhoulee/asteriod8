/**
 * <AudioTrack> — the clearly-marked audio slot.
 *
 * Renders nothing until you wire up a track in `src/config/audio.ts`. The spot
 * is choreographed to 120 BPM (a beat every 15 frames). See that file for the
 * exact beat-frame map and scene-5 hit timings.
 */
import React from "react";
import { Audio, staticFile } from "remotion";
import { AUDIO } from "../config/audio";

export const AudioTrack: React.FC = () => {
  if (!AUDIO.src) return null;
  return <Audio src={staticFile(AUDIO.src)} volume={AUDIO.volume} />;
};
