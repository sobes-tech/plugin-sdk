import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { definePlugin } from "./index";
import { manifest } from "../examples/meeting-markdown/manifest";
import { inlineViews, manifest as slotsManifest, slotEntries } from "../examples/ui-slots/manifest";
import { manifest as calculatorManifest } from "../plugins/system-design-calculator/manifest";
import { manifest as crashManifest } from "../examples/crash-test/manifest";

describe("Пакет примера", () => {
  it("ships actual React, scheduler and KaTeX license texts in the generated UI package", async () => {
    const installed = await Bun.file(
      resolve(import.meta.dir, "../examples/bundles/meeting-library.json"),
    ).json();
    const javascript = installed.ui.javascript as string;

    expect(javascript).toStartWith("/*!\nThird-party licenses and notices");
    expect(javascript).toContain("=== react@19.1.0 ===");
    expect(javascript).toContain("=== react-dom@19.1.0 ===");
    expect(javascript).toContain("=== scheduler@");
    expect(javascript).toContain("=== katex@0.16.23 ===");
    expect(javascript).toContain("Copyright (c) Meta Platforms, Inc. and affiliates.");
    expect(javascript).toContain("Copyright (c) 2013-2020 Khan Academy and other contributors");
    expect(javascript).toContain("Permission is hereby granted, free of charge");
  });

  it("собран из актуального SDK и совпадает с встроенным пакетом", async () => {
    const result = await Bun.build({
      entrypoints: [resolve(import.meta.dir, "../examples/meeting-markdown/index.ts")],
      target: "browser",
      format: "iife",
      minify: true,
      sourcemap: "none",
      splitting: false,
    });

    expect(result.success).toBe(true);
    const installed = await Bun.file(
      resolve(import.meta.dir, "../examples/bundles/meeting-markdown.json"),
    ).json();

    expect(installed.manifest).toEqual(manifest);
    expect(installed.source).toBe(await result.outputs[0].text());
  });

  it("не регистрирует плагин вне изолированного runtime", () => {
    expect(() => definePlugin({ commands: {} })).toThrow("inside Sobes");
  });

  it("covers every public slot, including a React workspace view with overlay permission", () => {
    expect(slotEntries).toHaveLength(21);
    const views = slotsManifest.views ?? [];

    expect(new Set(views.map((view) => view.id)).size).toBe(23);
    expect(new Set(views.map((view) => view.slot)).size).toBe(21);
    expect(views.filter((view) => view.slot.startsWith("overlay."))).toHaveLength(8);
    expect(views.filter((view) => view.display === undefined)).toHaveLength(21);
    expect(views.find((view) => view.slot === "overlay.workspace")).toMatchObject({
      id: "overlay.workspace",
      renderer: "react",
    });

    expect(slotsManifest.permissions).toContain("overlay.render");
  });

  it("adds an inline toolbar toggle and message action without replacing slot coverage", () => {
    expect(inlineViews).toEqual([
      expect.objectContaining({
        id: "inline-toggle",
        slot: "overlay.toolbar",
        renderer: "react",
        display: "inline",
      }),
      expect.objectContaining({
        id: "inline-action",
        slot: "overlay.message.footer",
        renderer: "react",
        display: "inline",
      }),
    ]);
  });

  it("ships the UI Slots package with the current inline-control manifest", async () => {
    const installed = await Bun.file(
      resolve(import.meta.dir, "../examples/bundles/ui-slots.json"),
    ).json();

    expect(installed.manifest).toEqual(slotsManifest);
    expect(installed.ui.javascript).toBeTruthy();
    expect(installed.ui.css).toBeTruthy();
  });

  it("keeps crash tests explicitly triggered without network or account-data access", async () => {
    const installed = await Bun.file(
      resolve(import.meta.dir, "../examples/bundles/crash-test.json"),
    ).json();

    expect(installed.manifest).toEqual(crashManifest);
    expect(installed.manifest.permissions).toEqual(["ui.render"]);
    expect(installed.manifest.events).toBeUndefined();
    expect(installed.manifest.grants).toBeUndefined();
    expect(installed.manifest.networkDomains).toBeUndefined();
    expect(installed.manifest.commands.map((command: { id: string }) => command.id)).toEqual([
      "worker-throw",
      "worker-timeout",
    ]);

    expect(
      installed.manifest.commands.every(
        (command: { location: string }) => command.location === "settings",
      ),
    ).toBe(true);

    expect(installed.source).not.toBe("void 0");
    expect(installed.ui.javascript).toBeTruthy();
  });

  it("opens the calculator only in the meeting workspace without broader permissions", () => {
    expect(calculatorManifest.views).toEqual([
      {
        id: "calculator",
        title: { en: "Calculator", ru: "Калькулятор" },
        slot: "overlay.workspace",
        renderer: "react",
        icon: "chart",
      },
    ]);

    expect(calculatorManifest.permissions).toEqual(["overlay.render"]);
  });
});
