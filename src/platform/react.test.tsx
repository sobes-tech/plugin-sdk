import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { usePluginApi } from "./react";
import type { PluginApi } from "./index";

describe("platform React client", () => {
  it("renders without a bridge and rejects unsupported calls explicitly", async () => {
    let api: PluginApi | undefined;

    function Probe() {
      api = usePluginApi();

      return createElement("span", null, "Ready");
    }

    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>Ready</span>");
    await expect(api!.notes.get("one")).rejects.toMatchObject({
      code: "unsupported_api_version",
    });
  });
});
