import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBuildNotices } from "./build-notices";

function metadata(inputs: Record<string, number>): Bun.BuildMetafile {
  return {
    inputs: {},
    outputs: {
      "bundle.js": {
        bytes: 1,
        imports: [],
        exports: [],
        inputs: Object.fromEntries(
          Object.entries(inputs).map(([path, bytesInOutput]) => [path, { bytesInOutput }]),
        ),
      },
    },
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "sobes-license-test-"));

  await Bun.write(join(root, "package.json"), JSON.stringify({ name: "test-plugin" }));

  return root;
}

describe("Bundled dependency notices", () => {
  it("preserves actual license and notice files once per included package", async () => {
    const root = await fixture();
    const dependency = join(root, "node_modules", "example");

    await Bun.write(
      join(dependency, "package.json"),
      JSON.stringify({ name: "example", version: "2.0.0", license: "MIT" }),
    );

    await Bun.write(
      join(dependency, "LICENSE"),
      "Copyright Example\nPermission from the package author.\n",
    );

    await Bun.write(join(dependency, "NOTICE.txt"), "Additional attribution.\n");
    await Bun.write(join(dependency, "dist", "package.json"), JSON.stringify({ type: "module" }));
    const result = await collectBuildNotices(
      metadata({
        "src/index.ts": 1,
        "node_modules/example/dist/index.js": 1,
        "node_modules/example/other.js": 1,
        "node_modules/not-bundled/index.js": 0,
      }),
      "src/index.ts",
      root,
    );

    expect(result.comment).toContain("Copyright Example\nPermission from the package author.\n");
    expect(result.comment).toContain("Additional attribution.\n");
    expect(result.comment.match(/=== example@2.0.0 ===/g)).toHaveLength(1);
    expect(result.comment).not.toContain("test-plugin");
    expect(result.comment).not.toContain("not-bundled");
    expect(result.missing).toEqual([]);
  });

  it("records missing upstream text without inventing a license notice", async () => {
    const root = await fixture();

    await Bun.write(
      join(root, "node_modules", "missing", "package.json"),
      JSON.stringify({
        name: "missing",
        version: "1.0.0",
        license: "MIT",
        repository: "https://example.com/source",
      }),
    );

    const result = await collectBuildNotices(
      metadata({ "node_modules/missing/index.js": 1 }),
      "src/index.ts",
      root,
    );

    expect(result.missing).toEqual(["missing@1.0.0"]);
    expect(result.comment).toContain('Declared license: "MIT"');
    expect(result.comment).toContain("No license/notice file");
    expect(result.comment).not.toContain("Permission is hereby granted");
  });

  it("keeps hostile notice text nonexecutable and sorts independently of input order", async () => {
    const root = await fixture();

    for (const name of ["alpha", "zeta"]) {
      await Bun.write(
        join(root, "node_modules", name, "package.json"),
        JSON.stringify({ name, version: "1" }),
      );

      await Bun.write(
        join(root, "node_modules", name, "LICENSE"),
        '*/ throw new Error("executed"); /* </script>',
      );
    }

    const first = await collectBuildNotices(
      metadata({ "node_modules/zeta/index.js": 1, "node_modules/alpha/index.js": 1 }),
      "src/index.ts",
      root,
    );
    const second = await collectBuildNotices(
      metadata({ "node_modules/alpha/index.js": 1, "node_modules/zeta/index.js": 1 }),
      "src/index.ts",
      root,
    );

    expect(first.comment).toBe(second.comment);
    expect(first.comment).not.toContain("</script>");
    expect(new Function(first.comment + "\nreturn 42;")()).toBe(42);
  });
});
