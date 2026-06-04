/**
 * <AsteroidCommercial> — the master timeline.
 *
 * Layer order (bottom → top):
 *   1. Background        — the deep-space void
 *   2. ParticleField     — the continuous asteroid field (the spine of the spot)
 *   3. Scene foregrounds — one <Sequence> per scene, text/cones/flares/EQ
 *   4. GlowFlash         — global ignition/logo bloom
 *   5. Vignette + Grain  — cinematic finish
 *   6. AudioTrack        — the (optional) music bed
 *
 * Both the vertical and horizontal compositions render THIS exact component;
 * every layer reads the canvas size and adapts.
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Background } from "./field/Background";
import { ParticleField } from "./field/ParticleField";
import { GlowFlash } from "./effects/GlowFlash";
import { Vignette } from "./effects/Vignette";
import { FilmGrain } from "./effects/FilmGrain";
import { AudioTrack } from "./AudioTrack";
import { Scene01SinglePoint } from "./scenes/Scene01SinglePoint";
import { Scene02FieldSpotlight } from "./scenes/Scene02FieldSpotlight";
import { Scene03Ignition } from "./scenes/Scene03Ignition";
import { Scene04ProductTruths } from "./scenes/Scene04ProductTruths";
import { Scene05Concert } from "./scenes/Scene05Concert";
import { Scene06Logo } from "./scenes/Scene06Logo";
import { SCENES, type SceneId } from "../config/timings";
import { COLORS } from "../config/theme";

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  s1: Scene01SinglePoint,
  s2: Scene02FieldSpotlight,
  s3: Scene03Ignition,
  s4: Scene04ProductTruths,
  s5: Scene05Concert,
  s6: Scene06Logo,
};

export const AsteroidCommercial: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Background />
      <ParticleField />

      {SCENES.map((scene) => {
        const SceneComponent = SCENE_COMPONENTS[scene.id];
        return (
          <Sequence
            key={scene.id}
            from={scene.from}
            durationInFrames={scene.duration}
            name={scene.name}
          >
            <SceneComponent />
          </Sequence>
        );
      })}

      <GlowFlash />
      <Vignette />
      <FilmGrain />
      <AudioTrack />
    </AbsoluteFill>
  );
};
