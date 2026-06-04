// Remotion CLI configuration.
// Docs: https://www.remotion.dev/docs/config
import { Config } from "@remotion/cli/config";

// JPEG frames render faster than PNG and are perfect for this fully-opaque spot.
Config.setVideoImageFormat("jpeg");

// Crisp output for a promo spot.
Config.setJpegQuality(95);

// Overwrite the output file if it already exists so re-renders are frictionless.
Config.setOverwriteOutput(true);

// The asteroid field leans on CSS gradients, blends and SVG filters. The ANGLE
// renderer gives the most consistent GPU-accelerated output across machines.
Config.setChromiumOpenGlRenderer("angle");
