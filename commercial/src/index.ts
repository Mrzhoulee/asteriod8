// Remotion entry point — registers the root so the Studio + CLI can find the
// compositions. Keep this file as the render entry: `remotion render src/index.ts`.
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
