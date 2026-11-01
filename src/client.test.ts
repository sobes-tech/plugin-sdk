import { describe, expect, it } from "bun:test";
import { createPluginClient } from "./client";
import type { JsonValue, PluginContext } from "./index";
import type { ReactPluginContext } from "./react";

describe("React API client", () => {
  it("routes typed resources through the same host API boundary", async () => {
    const calls: unknown[] = [];
    const api = createPluginClient(async (method, params) => {
      calls.push({ method, params });

      return null;
    });

    await api.meetings.list({ query: "test", limit: 10 });
    await api.screenshots.get("meeting", "image");
    await api.notes.create({ name: "Draft", content: "Text" });
    await api.app.openPage("history", { meetingId: "one" });
    expect(calls).toEqual([
      { method: "meetings.list", params: { query: "test", limit: 10 } },
      { method: "screenshots.get", params: { meetingId: "meeting", id: "image" } },
      { method: "notes.create", params: { name: "Draft", content: "Text" } },
      { method: "app.openPage", params: { viewId: "history", query: { meetingId: "one" } } },
    ]);
  });

  it("ships React, hooks and CSS as one installable package", async () => {
    const pkg = await Bun.file(
      new URL("../examples/bundles/react-workspace.json", import.meta.url),
    ).json();

    expect(
      pkg.manifest.views.every((view: { renderer: string }) => view.renderer === "react"),
    ).toBe(true);

    expect(pkg.ui.javascript.length).toBeGreaterThan(100_000);
    expect(pkg.ui.javascript).toContain("__SOBES_PLUGIN_UI__");
    expect(pkg.ui.css).toContain(".workspace-columns");
    expect(pkg.ui.css).toContain(".sobes-pill");
    expect(new TextEncoder().encode(JSON.stringify(pkg)).length).toBeLessThanOrEqual(
      32 * 1024 * 1024,
    );
  });

  it("routes owned and user-selected JSON files without exposing native paths", async () => {
    const value = { tasks: [{ done: false, title: "Follow up" }], count: 1, extra: null };
    const calls: unknown[] = [];
    const client = createPluginClient(async (method, params) => {
      calls.push({ method, params });
      const responses: Record<string, JsonValue> = {
        "files.readJson": value,
        "files.writeJson": null,
        "files.list": [{ path: "tasks.json", sizeBytes: 83 }],
        "files.openJson": { name: "import.json", value },
        "files.saveJson": true,
      };

      return responses[method];
    });
    const reactFiles: ReactPluginContext["files"] = client.files;
    const workerFiles: Omit<PluginContext["files"], "exportText"> = client.files;

    expect(await reactFiles.readJson("tasks.json")).toEqual(value);
    expect(await workerFiles.writeJson("tasks.json", value)).toBeUndefined();
    expect(await client.files.list()).toEqual([{ path: "tasks.json", sizeBytes: 83 }]);
    expect(await client.files.openJson()).toEqual({ name: "import.json", value });
    expect(await client.files.saveJson("export.json", value)).toBe(true);
    expect(calls).toEqual([
      { method: "files.readJson", params: { path: "tasks.json" } },
      { method: "files.writeJson", params: { path: "tasks.json", value } },
      { method: "files.list", params: {} },
      { method: "files.openJson", params: {} },
      { method: "files.saveJson", params: { filename: "export.json", value } },
    ]);

    expect("exportText" in reactFiles).toBe(false);
  });

  it("preserves missing files, canceled pickers and host errors", async () => {
    const client = createPluginClient(async (method) =>
      method === "files.saveJson" ? false : null,
    );

    expect(await client.files.readJson("missing.json")).toBeNull();
    expect(await client.files.openJson()).toBeNull();
    expect(await client.files.saveJson("export.json", null)).toBe(false);
    const failure = new Error("plugin_files_quota_exceeded");
    const failingClient = createPluginClient(async () => {
      throw failure;
    });

    await expect(failingClient.files.writeJson("tasks.json", {})).rejects.toBe(failure);
    await expect(failingClient.files.list()).rejects.toBe(failure);
  });
});
