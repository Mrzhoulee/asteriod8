/**
 * LAYOUT — responsive helpers so the SAME scene components fill both the
 * 1080×1920 vertical and 1920×1080 horizontal canvases without cropping.
 *
 * Type sizes are expressed in `vmin` (a fraction of the SHORTER side) so a
 * headline designed once fits both orientations and never overflows height.
 * Positions are expressed as fractions of width/height.
 */
import { useVideoConfig } from "remotion";

export interface Layout {
  width: number;
  height: number;
  isPortrait: boolean;
  /** 1% of the shorter side — use for type + element sizing. */
  vmin: number;
  /** 1% of the longer side. */
  vmax: number;
  /** 1% of width. */
  vw: number;
  /** 1% of height. */
  vh: number;
  /** Pick a value per orientation. */
  pick: <T>(portrait: T, landscape: T) => T;
}

export const useLayout = (): Layout => {
  const { width, height } = useVideoConfig();
  const isPortrait = height >= width;
  return {
    width,
    height,
    isPortrait,
    vmin: Math.min(width, height) / 100,
    vmax: Math.max(width, height) / 100,
    vw: width / 100,
    vh: height / 100,
    pick: <T,>(portrait: T, landscape: T): T => (isPortrait ? portrait : landscape),
  };
};
