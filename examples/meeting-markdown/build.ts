import { resolve } from "node:path";
import { buildPlugin } from "../../src/build";
import { manifest } from "./manifest";

await buildPlugin({
  manifest,
  entrypoint: resolve(import.meta.dir, "index.ts"),
  outfile: resolve(import.meta.dir, "../bundles/meeting-markdown.json"),
});
