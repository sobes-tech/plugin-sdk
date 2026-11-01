import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BunPlugin } from "bun";
import type { PluginManifest, PluginPackage } from "./index";
import { collectBuildNotices } from "./build-notices";

const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const OVERLAY_CONTROL_SLOTS = new Set([
  "overlay.toolbar",
  "overlay.panel",
  "overlay.footer",
  "overlay.message.header",
  "overlay.message.footer",
]);

function validNetworkDomain(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 253) {
    return false;
  }

  if (value === "*") {
    return true;
  }

  const hostname = value.startsWith("*.") ? value.slice(2) : value;
  const labels = hostname.split(".");

  return (
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  );
}

// Keep one offline font format; bundled fonts obey the sandbox's data-only policy.
const inlineMathFonts: BunPlugin = {
  name: "inline-math-fonts",
  setup(build) {
    build.onLoad({ filter: /katex[\\/]dist[\\/]katex(?:\.min)?\.css$/ }, async ({ path }) => {
      let contents = (await readFile(path, "utf8")).replace(
        /src:url\(([^)]*\.woff2)\)[^;}]*/g,
        'src:url($1) format("woff2")',
      );

      for (const [match, font] of [...contents.matchAll(/url\(([^)]*\.woff2)\)/g)]) {
        const data = await readFile(resolve(dirname(path), font));

        contents = contents.replace(
          match,
          `url(data:font/woff2;base64,${data.toString("base64")})`,
        );
      }

      return { contents, loader: "css" };
    });
  },
};

/** Bundles locally with Bun; installation never installs or executes dependencies. */
export async function buildPlugin(options: {
  manifest: PluginManifest;
  entrypoint?: string;
  uiEntrypoint?: string;
  outfile: string;
}): Promise<void> {
  const domains = options.manifest.networkDomains;

  if (
    domains !== undefined &&
    (!Array.isArray(domains) ||
      domains.length > 32 ||
      domains.some((domain) => !validNetworkDomain(domain)))
  ) {
    throw new Error("networkDomains must contain up to 32 hostnames, * or *.domain patterns");
  }

  for (const setting of options.manifest.settings ?? []) {
    if (
      setting.inputType !== undefined &&
      (typeof setting.default !== "string" ||
        !["text", "url", "password"].includes(setting.inputType))
    ) {
      throw new Error(
        "Setting inputType requires a string default and must be text, url or password",
      );
    }
  }

  for (const view of options.manifest.views ?? []) {
    if (
      view.display !== undefined &&
      (typeof view.display !== "string" || !["popover", "inline"].includes(view.display))
    ) {
      throw new Error("View display must be popover or inline");
    }

    if (view.display !== undefined && !OVERLAY_CONTROL_SLOTS.has(view.slot)) {
      throw new Error("View display is supported only in overlay control slots");
    }

    if (
      view.inlineWidth !== undefined &&
      (view.display !== "inline" ||
        typeof view.inlineWidth !== "number" ||
        !Number.isInteger(view.inlineWidth) ||
        view.inlineWidth < 24 ||
        view.inlineWidth > 240)
    ) {
      throw new Error("View inlineWidth requires display inline and an integer from 24 to 240");
    }

    if (view.display === "inline" && (view.renderer !== "react" || !options.uiEntrypoint)) {
      throw new Error("Inline views require renderer react and a UI entrypoint");
    }
  }

  const bundle = async (entrypoint: string) => {
    const result = await Bun.build({
      entrypoints: [entrypoint],
      target: "browser",
      format: "iife",
      minify: true,
      sourcemap: "none",
      splitting: false,
      metafile: true,
      plugins: [inlineMathFonts],
      define: { "process.env.NODE_ENV": '"production"' },
    });

    if (!result.success) {
      return { result, notices: "" };
    }

    if (!result.metafile) {
      throw new Error("License notice collection requires Bun build metafile support");
    }

    const notices = await collectBuildNotices(result.metafile, entrypoint);

    if (notices.missing.length) {
      console.warn(
        `[plugin-sdk] Review missing upstream license texts: ${notices.missing.join(", ")}`,
      );
    }

    return { result, notices: notices.comment };
  };

  const result = options.entrypoint ? await bundle(options.entrypoint) : null;

  if (result && !result.result.success) {
    throw new AggregateError(result.result.logs, "Plugin bundle failed");
  }

  if (result && result.result.outputs.length !== 1) {
    throw new Error("Worker must produce one self-contained JS bundle");
  }

  const source = result ? result.notices + (await result.result.outputs[0].text()) : "void 0";
  const pkg: PluginPackage = { manifest: options.manifest, source };

  if (options.uiEntrypoint) {
    const ui = await bundle(options.uiEntrypoint);

    if (!ui.result.success) {
      throw new AggregateError(ui.result.logs, "React UI bundle failed");
    }

    const js = ui.result.outputs.filter((output) => output.path.endsWith(".js"));
    const css = ui.result.outputs.filter((output) => output.path.endsWith(".css"));

    if (js.length !== 1 || js.length + css.length !== ui.result.outputs.length) {
      throw new Error("UI must bundle all dependencies; inline images and fonts as data URLs");
    }

    pkg.ui = {
      javascript: ui.notices + (await js[0].text()),
      ...(css.length
        ? { css: (await Promise.all(css.map((file) => file.text()))).join("\n") }
        : {}),
    };
  }

  if (!options.entrypoint && !options.uiEntrypoint) {
    throw new Error("Provide a worker or React UI entrypoint");
  }

  const text = JSON.stringify(pkg, null, 2) + "\n";

  if (new TextEncoder().encode(text).length > MAX_PACKAGE_BYTES) {
    throw new Error("Plugin package exceeds 32 MiB");
  }

  await Bun.write(options.outfile, text);
}
