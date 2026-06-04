/**
 * <KineticText> — physics-based, per-character type animation.
 *
 * Text is split into words (so it still wraps) and each character springs in
 * with a stagger. Several presets give each headline its own personality:
 *   • rise      — characters lift up with a micro overshoot
 *   • overshoot — punchy scale-up that blows past 1 then settles
 *   • flip      — characters rotate up on the X axis
 *   • scaleBlur — characters resolve out of a blur
 *
 * Everything is driven by spring()/useCurrentFrame() so it's deterministic.
 */
import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, lerp } from "../../lib/math";

export type KineticPreset = "rise" | "overshoot" | "flip" | "scaleBlur";

interface KineticTextProps {
  text: string;
  /** Local frame the first character starts on. */
  startFrame?: number;
  /** Frames between consecutive characters. */
  stagger?: number;
  preset?: KineticPreset;
  /** Styles for the text block (font, size, colour, tracking…). */
  style?: React.CSSProperties;
  /** Extra styles applied to every character span. */
  charStyle?: React.CSSProperties;
  /** Local frame to begin a fade-out (optional). */
  exitStart?: number;
  exitDuration?: number;
}

const SPRING_CONFIG: Record<KineticPreset, Parameters<typeof spring>[0]["config"]> = {
  rise: { damping: 12, mass: 0.8, stiffness: 120 },
  overshoot: { damping: 9, mass: 0.9, stiffness: 150 },
  flip: { damping: 14, mass: 0.9, stiffness: 110 },
  scaleBlur: { damping: 16, mass: 1, stiffness: 90 },
};

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  startFrame = 0,
  stagger = 2,
  preset = "rise",
  style,
  charStyle,
  exitStart,
  exitDuration = 12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOpacity =
    exitStart === undefined
      ? 1
      : interpolate(frame, [exitStart, exitStart + exitDuration], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const words = text.split(" ");
  let charIndex = 0;

  const renderChar = (ch: string, key: string) => {
    const i = charIndex++;
    const start = startFrame + i * stagger;
    const local = frame - start;
    const sp =
      local <= 0
        ? 0
        : spring({ frame: local, fps, config: SPRING_CONFIG[preset] });
    const appear = interpolate(frame, [start, start + 5], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    let transform = "";
    let filter: string | undefined;
    let transformOrigin = "center";

    switch (preset) {
      case "rise":
        // Lift from below with the spring's natural overshoot.
        transform = `translateY(${(1 - sp) * 70}%)`;
        transformOrigin = "bottom";
        break;
      case "overshoot":
        // Pop past full size then settle.
        transform = `scale(${0.4 + 0.6 * sp}) translateY(${(1 - clamp(sp)) * 20}%)`;
        break;
      case "flip":
        transform = `perspective(700px) rotateX(${(1 - sp) * -92}deg)`;
        transformOrigin = "bottom center";
        break;
      case "scaleBlur":
        transform = `scale(${lerp(0.62, 1, sp)})`;
        filter = `blur(${(1 - clamp(sp)) * 9}px)`;
        break;
    }

    return (
      <span
        key={key}
        style={{
          display: "inline-block",
          transform,
          transformOrigin,
          filter,
          opacity: appear * exitOpacity,
          willChange: "transform, opacity, filter",
          ...charStyle,
        }}
      >
        {ch}
      </span>
    );
  };

  return (
    <div style={{ display: "block", ...style }}>
      {words.map((word, wi) => (
        <React.Fragment key={wi}>
          {/* Keep each word together; wrapping only happens between words. */}
          <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {[...word].map((ch, ci) => renderChar(ch, `${wi}-${ci}`))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </div>
  );
};
