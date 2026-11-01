/** @jsxImportSource react */
import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ComponentType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

let Notepad: ComponentType;
let rendered: ReactTestRenderer | undefined;
let finishLoad: (value: string | null) => void;
const save = mock(async (_key: string, _value: string) => {});
const storage = {
  get: () =>
    new Promise<string | null>((resolve) => {
      finishLoad = resolve;
    }),
  set: save,
};
const overlay = { context: async () => ({ title: "Meeting" }) };

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

mock.module("../../src/react", () => ({
  renderPlugin: (views: Record<string, ComponentType>) => {
    Notepad = views.notepad;
  },
  usePlugin: () => ({
    storage,
    overlay,
    locale: "en",
    context: { meetingId: "meeting" },
    settings: {},
  }),
}));

beforeAll(async () => {
  await import("./index");
});

beforeEach(() => {
  save.mockClear();
});

afterEach(async () => {
  await act(async () => {
    rendered?.unmount();
  });
});

describe("Overlay notepad loading", () => {
  it("preserves edits made before the initial storage read finishes", async () => {
    await act(async () => {
      rendered = create(<Notepad />);
    });

    await act(async () => {
      rendered!.root.findByType("textarea").props.onChange({ target: { value: "New draft" } });
    });

    await act(async () => {
      finishLoad("Old saved note");
    });

    expect(rendered!.root.findByType("textarea").props.value).toBe("New draft");
    await act(async () => {
      rendered!.root.findByType("textarea").props.onBlur();
    });

    expect(save).toHaveBeenCalledWith("scratch", "New draft");
  });

  it("loads untouched saved text and does not overwrite storage merely on blur", async () => {
    await act(async () => {
      rendered = create(<Notepad />);
    });

    await act(async () => {
      rendered!.root.findByType("textarea").props.onBlur();
    });

    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      finishLoad("Saved note");
    });

    expect(rendered!.root.findByType("textarea").props.value).toBe("Saved note");
  });
});
