import { resolve } from "node:path";
import { buildPlugin } from "../../src/build";
import { manifest } from "./manifest";

await buildPlugin({
  manifest,
  uiEntrypoint: resolve(import.meta.dir, "index.tsx"),
  outfile: resolve(import.meta.dir, "../bundles/system-design-calculator.json"),
});
