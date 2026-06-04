/**
 * Fonts are loaded via @remotion/google-fonts, which registers a delayRender()
 * handle internally so renders wait until the glyphs are ready.
 *
 * Headline: Space Grotesk — a modern geometric grotesque with tight, confident
 *           letterforms. Body: Inter — a clean neutral sans for captions/labels.
 */
import { loadFont as loadHeadlineFont } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBodyFont } from "@remotion/google-fonts/Inter";

const headline = loadHeadlineFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const body = loadBodyFont("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const FONT_HEADLINE = headline.fontFamily;
export const FONT_BODY = body.fontFamily;
