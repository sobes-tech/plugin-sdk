/** @jsxImportSource react */
import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ComponentType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

let Gallery: ComponentType;
let rendered: ReactTestRenderer | undefined;
let meetingId = "meeting";
let listUnavailable = false;
let firstUnavailable = true;
const image = "data:image/png;base64,aGVsbG8=";
const screenshots = {
  list: async () => {
    if (listUnavailable) {
      throw new Error("List temporarily unavailable");
    }

    return [{ id: "first" }, { id: "second" }];
  },
  get: async (_meeting: string, id: string) => {
    if (id === "first" && firstUnavailable) {
      throw new Error("Image temporarily unavailable");
    }

    return { dataUrl: image };
  },
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

mock.module("../../src/react", () => ({
  renderPlugin: (views: Record<string, ComponentType>) => {
    Gallery = views.gallery;
  },
  usePlugin: () => ({ screenshots, context: { meetingId }, locale: "en" }),
}));

beforeAll(async () => {
  await import("./index");
});

beforeEach(() => {
  meetingId = "meeting";
  listUnavailable = false;
  firstUnavailable = true;
});

afterEach(async () => {
  await act(async () => {
    rendered?.unmount();
  });
});

describe("Meeting gallery recovery", () => {
  it("shows a successful selection after a previous screenshot failed", async () => {
    await act(async () => {
      rendered = create(<Gallery />);
    });

    expect(JSON.stringify(rendered!.toJSON())).toContain("Could not load screenshots");
    await act(async () => {
      rendered!.root.findAllByType("button")[1].props.onClick();
    });

    expect(rendered!.root.findByType("img").props.src).toBe(image);
    expect(JSON.stringify(rendered!.toJSON())).not.toContain("Could not load screenshots");
  });

  it("retries the selected screenshot after a transient image failure", async () => {
    await act(async () => {
      rendered = create(<Gallery />);
    });

    firstUnavailable = false;
    await act(async () => {
      rendered!.root
        .findAllByType("button")
        .find((button) => button.children.includes("Retry"))!
        .props.onClick();
    });

    expect(rendered!.root.findByType("img").props.src).toBe(image);
  });

  it("retries loading the screenshot list after a transient list failure", async () => {
    listUnavailable = true;
    await act(async () => {
      rendered = create(<Gallery />);
    });

    listUnavailable = false;
    firstUnavailable = false;
    await act(async () => {
      rendered!.root
        .findAllByType("button")
        .find((button) => button.children.includes("Retry"))!
        .props.onClick();
    });

    expect(rendered!.root.findByType("img").props.src).toBe(image);
  });

  it("clears the previous meeting's image when the context has no meeting", async () => {
    await act(async () => {
      rendered = create(<Gallery />);
    });

    await act(async () => {
      rendered!.root.findAllByType("button")[1].props.onClick();
    });

    meetingId = "";
    await act(async () => {
      rendered!.update(<Gallery />);
    });

    expect(rendered!.root.findAllByType("img")).toHaveLength(0);
    expect(rendered!.root.findAllByType("button")).toHaveLength(0);
  });
});
