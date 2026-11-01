import { resolve } from "node:path";
import { buildPlugin } from "../../src/build";
import { manifest } from "./manifest";

await buildPlugin({
  manifest,
  entrypoint: resolve(import.meta.dir, "worker.ts"),
  uiEntrypoint: resolve(import.meta.dir, "index.tsx"),
  outfile: resolve(import.meta.dir, "../bundles/crash-test.json"),
});
