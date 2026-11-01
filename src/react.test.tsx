import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useWorkspaceHeaderTabs } from "./react";

describe("workspace header tabs", () => {
  it("keeps the inline fallback when the optional host bridge is absent", () => {
    let changes = 0;

    function Probe() {
      const supported = useWorkspaceHeaderTabs({
        items: [{ id: "load", label: "RPS" }],
        value: "load",
        onValueChange: () => {
          changes++;
        },
      });

      return createElement("span", null, supported ? "Host header" : "Inline tabs");
    }

    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>Inline tabs</span>");
    expect(changes).toBe(0);
  });
});
