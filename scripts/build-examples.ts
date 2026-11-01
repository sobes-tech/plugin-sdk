import { resolve } from "node:path";
import { buildPlugin } from "../src/build";
import { manifest as markdown } from "../examples/meeting-markdown/manifest";
import { manifest as library } from "../examples/meeting-library/manifest";
import { manifest as notes } from "../examples/quick-notes/manifest";
import { manifest as react } from "../examples/react-workspace/manifest";
import { manifest as overlay } from "../examples/overlay-notepad/manifest";
import { manifest as slots } from "../examples/ui-slots/manifest";

for (const [directory, manifest, extension] of [
  ["meeting-markdown", markdown, "ts"],
  ["quick-notes", notes, "tsx"],
] as const) {
  await buildPlugin({
    manifest,
    entrypoint: resolve(import.meta.dir, `../examples/${directory}/index.${extension}`),
    outfile: resolve(import.meta.dir, `../examples/bundles/${directory}.json`),
  });
}

await buildPlugin({
  manifest: library,
  uiEntrypoint: resolve(import.meta.dir, "../examples/meeting-library/index.tsx"),
  outfile: resolve(import.meta.dir, "../examples/bundles/meeting-library.json"),
});

await buildPlugin({
  manifest: react,
  uiEntrypoint: resolve(import.meta.dir, "../examples/react-workspace/index.tsx"),
  outfile: resolve(import.meta.dir, "../examples/bundles/react-workspace.json"),
});

await buildPlugin({
  manifest: overlay,
  uiEntrypoint: resolve(import.meta.dir, "../examples/overlay-notepad/index.tsx"),
  outfile: resolve(import.meta.dir, "../examples/bundles/overlay-notepad.json"),
});

await buildPlugin({
  manifest: slots,
  uiEntrypoint: resolve(import.meta.dir, "../examples/ui-slots/index.tsx"),
  outfile: resolve(import.meta.dir, "../examples/bundles/ui-slots.json"),
});

await import("../examples/code-explainer/build");
await import("../examples/crash-test/build");
