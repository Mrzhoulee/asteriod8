# Asteroid — Promotional Commercial (Remotion)

A 20-second cinematic spot for **Asteroid** ([asteroid8.net](https://asteroid8.net)),
the anti-algorithm music platform. Built with [Remotion](https://remotion.dev) +
TypeScript and rendered to two formats from the **same** scene components:

| Composition          | Size        | Use                          |
| -------------------- | ----------- | ---------------------------- |
| `AsteroidVertical`   | 1080 × 1920 | TikTok / Instagram Reels     |
| `AsteroidHorizontal` | 1920 × 1080 | YouTube / landscape          |

Both are 30fps · 600 frames · 20 seconds.

---

## Quick start

```bash
cd commercial
npm install        # install dependencies
npm run dev        # open Remotion Studio (preview + scrub)
```

`npm run dev` (alias `npm run studio`) launches Remotion Studio at
`http://localhost:3000` where you can scrub the timeline and tweak in real time.

Type-check the project at any time:

```bash
npm run typecheck
```

---

## Render commands

The exact commands for both deliverables:

```bash
# Vertical — 1080×1920 (TikTok / Reels)
npx remotion render src/index.ts AsteroidVertical out/asteroid-vertical.mp4

# Horizontal — 1920×1080 (YouTube / landscape)
npx remotion render src/index.ts AsteroidHorizontal out/asteroid-horizontal.mp4
```

Or via the npm scripts:

```bash
npm run render:vertical
npm run render:horizontal
npm run render            # both, sequentially
```

Outputs land in `out/`. (First render downloads a Chromium Headless Shell.)

---

## The concept

An **asteroid field of music**. Thousands of glowing points drift in the dark —
each one an independent artist. Most platforms shine a spotlight on the same few;
**Asteroid lights them all equally**. Discovery is random and fair.

### Storyboard

| Scene | Frames    | Time        | Beat                                                    |
| ----- | --------- | ----------- | ------------------------------------------------------- |
| 1     | 0–90      | 0.0–3.0s    | A single dim point in the void. *"Every artist is out there."* |
| 2     | 90–180    | 3.0–6.0s    | Pull back to the field; a harsh spotlight picks a few. *"Most platforms only light up a few."* |
| 3     | 180–300   | 6.0–10.0s   | The spotlight shatters; **everything ignites** in a shockwave. *"We light up everyone."* |
| 4     | 300–420   | 10.0–14.0s  | Three kinetic truth cards: *No ads. / No algorithms. / Equal discovery.* |
| 5     | 420–510   | 14.0–17.0s  | Field becomes a concert crowd; EQ + screen-shake on the beat. *"Live shows. Real fans."* |
| 6     | 510–600   | 17.0–20.0s  | Convergence into the **ASTEROID** wordmark + lens flare. *"music, discovered fairly." · asteroid8.net* |

---

## Architecture

Everything tweakable lives in **config** so you can re-pace, re-colour and
re-word the spot without touching component logic.

```
commercial/
├─ remotion.config.ts        # render settings
├─ src/
│  ├─ index.ts               # registerRoot (render entry)
│  ├─ Root.tsx               # the two <Composition>s
│  ├─ fonts.ts               # @remotion/google-fonts (Space Grotesk + Inter)
│  ├─ config/
│  │  ├─ theme.ts            # palette, type scale, tracking
│  │  ├─ timings.ts          # master timeline + director cues (fps, scenes, BPM)
│  │  ├─ copy.ts             # every word on screen
│  │  ├─ audio.ts            # the audio slot + beat map
│  │  └─ layout.ts           # responsive useLayout() hook (vmin/vw/vh, pick())
│  ├─ lib/
│  │  ├─ math.ts             # clamp/lerp/smoothstep/wrap/bump …
│  │  ├─ color.ts            # RGB mixing + gradient sampling
│  │  ├─ particles.ts        # the deterministic 400-point field (seeded)
│  │  ├─ director.ts         # frame → field state (the motion spine)
│  │  ├─ beat.ts             # 120 BPM beat envelope + shake
│  │  └─ anim.ts             # fadeInOut helper
│  └─ components/
│     ├─ Composition.tsx     # master timeline (field + scene <Sequence>s + FX)
│     ├─ AudioTrack.tsx      # optional <Audio>
│     ├─ field/              # Background, ParticleField
│     ├─ effects/            # Vignette, FilmGrain, GlowFlash
│     ├─ ui/                 # KineticText (per-char spring animation)
│     └─ scenes/             # Scene01–06 (+ parts/SpotlightCone)
└─ public/audio/            # drop your track here
```

### Why a continuous field + per-scene foregrounds?

The asteroid field is **one element that lives for the whole 20s**, driven by the
**motion director** (`lib/director.ts`) off the absolute frame. Scenes don't each
spawn their own field; instead each scene's foreground (text, spotlight cone,
shockwave rings, equalizer, lens flare) sits on top in its own `<Sequence>`. This
is what gives the spot its seamless, single-take feel while keeping every scene
cleanly componentised — and it's why both formats can share the same components.

### Craft notes

- **Deterministic particles** — positions, depth, colour, drift and twinkle are
  seeded via Remotion's `random()` (see `lib/particles.ts`), so renders are
  byte-reproducible and identical across both formats.
- **Real shockwave** — in scene 3 each point's ignition is delayed by its radius
  from centre, so the wave reads as a true front expanding outward.
- **Physics-based motion** — entrances use `spring()` (with deliberate overshoot
  on headlines), reveals use `Easing.out(Easing.cubic)`. Nothing pops in flat.
- **Depth** — points parallax by their `z` depth as the camera drifts/pulls back.
- **Beat-synced** — scene 5's pulses and screen-shakes sit on the 120 BPM grid.
- **Cinematic finish** — additive (`screen`) glow bloom, a vignette and animated
  film grain.

### Tweak cheatsheet

- **Colours / fonts** → `src/config/theme.ts`
- **Timing / pacing** → `src/config/timings.ts` (`SCENES` + `CUES`)
- **Copy** → `src/config/copy.ts`
- **Music** → `src/config/audio.ts` + `public/audio/`
- **Field density / look** → `PARTICLE_COUNT` in `src/lib/particles.ts`,
  size/brightness constants in `src/components/field/ParticleField.tsx`
