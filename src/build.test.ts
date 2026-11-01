import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { buildPlugin } from "./build";
import type { PluginManifest, PluginPackage, PluginSlot, PluginViewContribution } from "./index";

const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const manifest: PluginManifest = {
  id: "test.package-size",
  version: "1.0.0",
  apiVersion: 1,
  name: { en: "Size test", ru: "Проверка размера" },
  description: { en: "Package size boundary", ru: "Граница размера пакета" },
  permissions: [],
  commands: [],
};

function serializedBytes(pkg: PluginPackage): number {
  return Buffer.byteLength(JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function artifact(path: string, text: string): Bun.BuildArtifact {
  return Object.assign(new Blob([text]), {
    path,
    loader: "js" as const,
    hash: null,
    kind: "entry-point" as const,
    sourcemap: null,
  });
}

function mockCompiler(source: string, javascript?: string, css?: string) {
  spyOn(Bun, "build").mockImplementation(async (options) => ({
    success: true,
    logs: [],
    outputs:
      options.entrypoints[0] === "worker.ts"
        ? [artifact("worker.js", source)]
        : [
            artifact("ui.js", javascript ?? ""),
            ...(css === undefined ? [] : [artifact("ui.css", css)]),
          ],
  }));

  return spyOn(Bun, "write").mockResolvedValue(0);
}

afterEach(() => mock.restore());

describe("Inline overlay controls", () => {
  const controlSlots: PluginSlot[] = [
    "overlay.toolbar",
    "overlay.panel",
    "overlay.footer",
    "overlay.message.header",
    "overlay.message.footer",
  ];
  const baseView: PluginViewContribution = {
    id: "control",
    title: { en: "Control", ru: "Элемент" },
    slot: "overlay.toolbar",
    renderer: "react",
  };

  it.each(controlSlots)("accepts both display modes in %s", async (slot) => {
    const write = mockCompiler("void 0", "ui");

    for (const display of ["popover", "inline"] as const) {
      await buildPlugin({
        manifest: { ...manifest, views: [{ ...baseView, slot, display }] },
        uiEntrypoint: "ui.tsx",
        outfile: "test-output.json",
      });
    }

    expect(write).toHaveBeenCalledTimes(2);
  });

  it.each([24, 36, 240])("accepts inline width %i", async (inlineWidth) => {
    const write = mockCompiler("void 0", "ui");

    await buildPlugin({
      manifest: { ...manifest, views: [{ ...baseView, display: "inline", inlineWidth }] },
      uiEntrypoint: "ui.tsx",
      outfile: "test-output.json",
    });

    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each(["", "popup", "INLINE", null, false, 36, {}, ["inline"]].map((display) => ({ display })))(
    "rejects an invalid display value %j before compiling",
    async ({ display }) => {
      const write = mockCompiler("void 0", "ui");
      const views = [{ ...baseView, display }] as unknown as PluginViewContribution[];

      await expect(
        buildPlugin({
          manifest: { ...manifest, views },
          uiEntrypoint: "ui.tsx",
          outfile: "test-output.json",
        }),
      ).rejects.toThrow("View display must be popover or inline");

      expect(Bun.build).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it.each(["overlay.workspace", "app.page", "meeting.header"] as const)(
    "rejects display on non-control slot %s",
    async (slot) => {
      const write = mockCompiler("void 0", "ui");

      for (const display of ["popover", "inline"] as const) {
        await expect(
          buildPlugin({
            manifest: { ...manifest, views: [{ ...baseView, slot, display }] },
            uiEntrypoint: "ui.tsx",
            outfile: "test-output.json",
          }),
        ).rejects.toThrow("View display is supported only in overlay control slots");
      }

      expect(Bun.build).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "popover"] as const)(
    "rejects width without inline display %s",
    async (display) => {
      const write = mockCompiler("void 0", "ui");

      await expect(
        buildPlugin({
          manifest: { ...manifest, views: [{ ...baseView, display, inlineWidth: 36 }] },
          uiEntrypoint: "ui.tsx",
          outfile: "test-output.json",
        }),
      ).rejects.toThrow("View inlineWidth requires display inline");

      expect(Bun.build).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it.each([23, 241, 24.5, null, "36", false, Infinity, NaN])(
    "rejects invalid inline width %j before compiling",
    async (inlineWidth) => {
      const write = mockCompiler("void 0", "ui");
      const views = [
        { ...baseView, display: "inline", inlineWidth },
      ] as unknown as PluginViewContribution[];

      await expect(
        buildPlugin({
          manifest: { ...manifest, views },
          uiEntrypoint: "ui.tsx",
          outfile: "test-output.json",
        }),
      ).rejects.toThrow("View inlineWidth requires display inline");

      expect(Bun.build).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it("requires a React renderer and UI bundle for inline controls", async () => {
    const write = mockCompiler("void 0", "ui");

    await expect(
      buildPlugin({
        manifest: { ...manifest, views: [{ ...baseView, display: "inline", renderer: undefined }] },
        uiEntrypoint: "ui.tsx",
        outfile: "test-output.json",
      }),
    ).rejects.toThrow("Inline views require renderer react and a UI entrypoint");

    await expect(
      buildPlugin({
        manifest: { ...manifest, views: [{ ...baseView, display: "inline" }] },
        entrypoint: "worker.ts",
        outfile: "test-output.json",
      }),
    ).rejects.toThrow("Inline views require renderer react and a UI entrypoint");

    expect(Bun.build).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps display optional for existing workspace and main views", async () => {
    const write = mockCompiler("void 0", "ui");

    await buildPlugin({
      manifest: {
        ...manifest,
        views: [
          { ...baseView },
          { ...baseView, id: "workspace", slot: "overlay.workspace" },
          { ...baseView, id: "page", slot: "app.page" },
        ],
      },
      uiEntrypoint: "ui.tsx",
      outfile: "test-output.json",
    });

    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe("Manifest network domains", () => {
  it.each([
    { networkDomains: [] },
    { networkDomains: ["api.example.com"] },
    { networkDomains: ["*"] },
    { networkDomains: ["*.example.com"] },
    { networkDomains: ["xn--e1afmkfd.xn--p1ai"] },
    { networkDomains: ["api.example.com", "*.example.org", "*"] },
    {
      networkDomains: [`*.${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(59)}`],
    },
    { networkDomains: Array.from({ length: 32 }, (_, index) => `api${index}.example.com`) },
  ])("accepts network domain declarations %j", async ({ networkDomains }) => {
    const write = mockCompiler("void 0");

    await buildPlugin({
      manifest: { ...manifest, networkDomains: [...networkDomains] },
      entrypoint: "worker.ts",
      outfile: "test-output.json",
    });

    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each([
    "",
    "localhost",
    "*.com",
    "api.*.com",
    "*example.com",
    "**.example.com",
    "*.*.example.com",
    "https://example.com",
    "example.com/path",
    "example.com:443",
    "Example.com",
    "пример.рф",
    "a..example.com",
    ".example.com",
    "example.com.",
    "-api.example.com",
    "api-.example.com",
    `${"a".repeat(64)}.com`,
    `*.${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(60)}`,
  ])("rejects invalid domain pattern %s before building", async (domain) => {
    const write = mockCompiler("void 0");

    await expect(
      buildPlugin({
        manifest: { ...manifest, networkDomains: [domain] },
        entrypoint: "worker.ts",
        outfile: "test-output.json",
      }),
    ).rejects.toThrow("networkDomains must contain");

    expect(Bun.build).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects more than 32 domain declarations before building", async () => {
    const write = mockCompiler("void 0");

    await expect(
      buildPlugin({
        manifest: {
          ...manifest,
          networkDomains: Array.from({ length: 33 }, (_, index) => `api${index}.example.com`),
        },
        entrypoint: "worker.ts",
        outfile: "test-output.json",
      }),
    ).rejects.toThrow("networkDomains must contain");

    expect(write).not.toHaveBeenCalled();
  });
});

describe("Package byte limit", () => {
  it("validates string input presentation before compiling", async () => {
    const write = mockCompiler("void 0");

    await expect(
      buildPlugin({
        manifest: {
          ...manifest,
          settings: [
            {
              id: "secret",
              title: { en: "Key", ru: "Ключ" },
              default: false,
              inputType: "password",
            },
          ],
        },
        entrypoint: "worker.ts",
        outfile: "test-output.json",
      }),
    ).rejects.toThrow("Setting inputType requires a string default");

    expect(write).not.toHaveBeenCalled();
  });

  it("writes a package at exactly 32 MiB, including its JSON envelope", async () => {
    const source = "a".repeat(MAX_PACKAGE_BYTES - serializedBytes({ manifest, source: "" }));
    const write = mockCompiler(source);

    await buildPlugin({ manifest, entrypoint: "worker.ts", outfile: "test-output.json" });

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0]).toBe("test-output.json");
    expect(Buffer.byteLength(String(write.mock.calls[0]![1]), "utf8")).toBe(MAX_PACKAGE_BYTES);
  });

  it("rejects one byte over 32 MiB before writing a file", async () => {
    const source = "a".repeat(MAX_PACKAGE_BYTES + 1 - serializedBytes({ manifest, source: "" }));
    const write = mockCompiler(source);

    await expect(
      buildPlugin({ manifest, entrypoint: "worker.ts", outfile: "test-output.json" }),
    ).rejects.toThrow("Plugin package exceeds 32 MiB");

    expect(write).not.toHaveBeenCalled();
  });

  it("counts multibyte CSS together with worker and React code", async () => {
    const source = "a".repeat(8 * 1024 * 1024);
    const javascript = "b".repeat(8 * 1024 * 1024);
    const remaining =
      MAX_PACKAGE_BYTES + 1 - serializedBytes({ manifest, source, ui: { javascript, css: "" } });
    const css = "界".repeat(Math.floor(remaining / 3)) + "c".repeat(remaining % 3);
    const pkg = { manifest, source, ui: { javascript, css } };

    expect(serializedBytes(pkg)).toBe(MAX_PACKAGE_BYTES + 1);
    expect(JSON.stringify(pkg, null, 2).length + 1).toBeLessThan(MAX_PACKAGE_BYTES);
    const write = mockCompiler(source, javascript, css);

    await expect(
      buildPlugin({
        manifest,
        entrypoint: "worker.ts",
        uiEntrypoint: "ui.tsx",
        outfile: "test-output.json",
      }),
    ).rejects.toThrow("Plugin package exceeds 32 MiB");

    expect(write).not.toHaveBeenCalled();
  });
});
