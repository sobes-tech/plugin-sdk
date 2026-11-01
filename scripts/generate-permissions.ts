import { resolve } from "node:path";
import definitions from "../src/permissions.json";

const output =
  "// Generated from permissions.json. Run bun run generate:permissions.\nexport type PluginPermission =\n" +
  definitions.map((p) => `  | ${JSON.stringify(p.id)}`).join("\n") +
  ";\n";
const path = resolve(import.meta.dir, "../src/permissions.generated.ts");

if (process.argv.includes("--check")) {
  if ((await Bun.file(path).text()) !== output) {
    throw new Error("Permission types are out of date");
  }
} else {
  await Bun.write(path, output);
}
