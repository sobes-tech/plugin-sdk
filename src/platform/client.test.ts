import { describe, expect, it } from "bun:test";
import { createPluginClient } from "../client";
import { PLUGIN_API_METHODS, createPluginApi } from "./client";
import type { HostCapabilities } from "./types";
import type { JsonValue } from "../index";

const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
const capabilities: HostCapabilities = {
  apiVersion: 1,
  protocolVersion: 1,
  features: ["events", "data.notes", "data.tracker"],
  methods: Object.keys(PLUGIN_API_METHODS),
  transports: { events: 1 },
  grants: [],
};

describe("resource API client", () => {
  it("keeps forty resource/event methods without model operations", () => {
    expect(Object.keys(PLUGIN_API_METHODS)).toHaveLength(40);
    expect(
      Object.keys(PLUGIN_API_METHODS).every(
        (method) => method.startsWith("data.") || method.startsWith("events."),
      ),
    ).toBe(true);

    const api = createPluginApi({ call: async () => json(capabilities) });

    expect("ai" in api).toBe(false);
    expect("chat" in api).toBe(false);
  });

  it("constructs clients without making requests", async () => {
    const calls: string[] = [];

    const call = async (method: string) => {
      calls.push(method);

      return null;
    };

    const core = createPluginClient(call);

    createPluginApi({ call });
    expect(calls).toEqual([]);
    await core.notes.create({ name: "Core note" });
    expect(calls).toEqual(["notes.create"]);
  });

  it("requires the advertised feature and exact method", async () => {
    const calls: string[] = [];
    const api = createPluginApi({
      call: async (method) => {
        calls.push(method);

        return json({ ...capabilities, methods: ["data.notes.get"] });
      },
    });

    await expect(
      api.notes.create({ idempotencyKey: "one", data: { name: "Test" } }),
    ).rejects.toMatchObject({ code: "unsupported_feature" });

    expect(calls).toEqual(["api.capabilities"]);
  });

  it("rejects unsupported protocol versions before forwarding mutations", async () => {
    const calls: string[] = [];
    const api = createPluginApi({
      call: async (method) => {
        calls.push(method);

        return { apiVersion: 99 };
      },
    });

    expect(await api.supports("data.notes")).toBe(false);
    await expect(
      api.notes.update({ id: "one", expectedRevision: "1", idempotencyKey: "key", patch: {} }),
    ).rejects.toMatchObject({ code: "unsupported_api_version" });

    expect(calls).toEqual(["api.capabilities"]);
  });

  it("forwards CAS and idempotency fields unchanged", async () => {
    const calls: { method: string; params?: JsonValue }[] = [];
    const api = createPluginApi({
      call: async (method, params) => {
        calls.push({ method, params });

        return json(
          method === "api.capabilities"
            ? capabilities
            : { id: "one", revision: "2", name: "After" },
        );
      },
    });
    const input = {
      id: "one",
      expectedRevision: "1",
      idempotencyKey: "key",
      patch: { name: "After" },
    };

    await api.notes.update(input);
    expect(calls[1]).toEqual({ method: "data.notes.update", params: input });
  });

  it("validates required mutation fields before dispatch", () => {
    const api = createPluginApi({ call: async () => json(capabilities) });

    expect(() =>
      api.notes.update({ id: "one", expectedRevision: "", idempotencyKey: "key", patch: {} }),
    ).toThrow();

    expect(() =>
      api.tracker.cards.trash({ id: "one", expectedRevision: "1", idempotencyKey: "" }),
    ).toThrow();
  });

  it("caches and explicitly refreshes capabilities", async () => {
    let calls = 0;
    const api = createPluginApi({
      call: async () => {
        calls++;

        return json(capabilities);
      },
    });

    await api.capabilities();
    await api.capabilities();
    expect(calls).toBe(1);
    await api.refreshCapabilities();
    expect(calls).toBe(2);
  });

  it("requires an event transport and passes snapshot cursors unchanged", async () => {
    const cursor = { token: "token", streamId: "stream", epoch: "epoch", seq: 2 };
    const api = createPluginApi({
      call: async (method) =>
        json(method === "api.capabilities" ? capabilities : { cursor, resources: [] }),
    });
    const target = { kind: "resource", resource: "note" } as const;

    expect(await api.events.snapshot(target)).toEqual({ cursor, resources: [] });
    await expect(api.events.subscribe({ target })).rejects.toMatchObject({
      code: "unsupported_transport",
    });
  });

  it("preserves a typed denial without retrying the mutation", async () => {
    let writes = 0;
    const api = createPluginApi({
      call: async (method) => {
        if (method === "api.capabilities") {
          return json(capabilities);
        }

        writes++;

        throw { code: "rate_limited", retryable: true, retryAfterMs: 1000 };
      },
    });

    await expect(
      api.notes.create({ idempotencyKey: "key", data: { name: "one" } }),
    ).rejects.toMatchObject({ code: "rate_limited", retryAfterMs: 1000 });

    expect(writes).toBe(1);
  });

  it("rejects malformed capabilities and resource responses", async () => {
    await expect(
      createPluginApi({ call: async () => ({ apiVersion: 1 }) }).capabilities(),
    ).rejects.toMatchObject({ code: "invalid_host_response" });

    const api = createPluginApi({
      call: async (method) => (method === "api.capabilities" ? json(capabilities) : null),
    });

    await expect(api.notes.get("one")).rejects.toMatchObject({ code: "invalid_host_response" });
  });
});
