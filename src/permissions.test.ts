import { describe, expect, it } from "bun:test";
import { permissions } from "./index";
import { jsx } from "./jsx-runtime";

describe("Контракт SDK", () => {
  it("хранит уникальные права и единственное право для каждого метода", () => {
    expect(new Set(permissions.map((p) => p.id)).size).toBe(permissions.length);
    const methods = permissions.flatMap((p) => p.methods);

    expect(new Set(methods).size).toBe(methods.length);

    for (const p of permissions) {
      expect(p.title.en.length).toBeGreaterThan(0);
      expect(p.title.ru.length).toBeGreaterThan(0);
    }
  });

  it("собирает JSX в данные, не исполняя обработчики в основном интерфейсе", () => {
    expect(jsx("button", { action: "save", children: "Save" })).toEqual({
      type: "element",
      tag: "button",
      props: { action: "save" },
      children: [{ type: "text", text: "Save" }],
    });
  });

  it("keeps owned files separate from explicit user-selected file authority", () => {
    expect(permissions.find((p) => p.id === "plugin.files")).toMatchObject({
      implicit: true,
      scope: "plugin",
      methods: ["files.readJson", "files.writeJson", "files.list"],
    });

    expect(permissions.find((p) => p.id === "files.userSelected")).toMatchObject({
      implicit: false,
      scope: "userSelectedPath",
      methods: ["files.openJson", "files.saveJson"],
    });

    expect(permissions.find((p) => p.id === "files.export")?.methods).toEqual([]);
  });
});
