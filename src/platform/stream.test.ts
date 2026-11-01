import { describe, expect, it } from "bun:test";
import {
  openEventSubscription,
  type HostEventTransport,
  type HostStreamConnection,
  type HostStreamFrame,
} from "./stream";
import type { PlatformEvent, StreamCursor } from "./types";

const cursor = (seq: number, epoch = "one"): StreamCursor => ({
  streamId: "stream",
  epoch,
  seq,
  token: `${epoch}:${seq}`,
});
const event = (seq: number, epoch = "one"): PlatformEvent => ({
  schemaVersion: 1,
  cursor: cursor(seq, epoch),
  eventId: `${epoch}:${seq}`,
  time: "2026-11-01T00:00:00Z",
  authority: "host-local",
  kind: "resource.changed",
  payload: { resource: "note", id: "note", revision: String(seq), change: "updated" },
});

function fixture() {
  const receivers: Array<(frame: unknown) => void> = [];
  const requests: Parameters<HostEventTransport["open"]>[0][] = [];
  const acknowledgements: StreamCursor[] = [];
  let closes = 0;
  const transport: HostEventTransport = {
    version: 1,
    open: async (request, receive) => {
      requests.push(request);
      receivers.push(receive);

      return {
        acknowledge: async (value) => {
          acknowledgements.push(value);
        },
        close: async () => {
          closes++;
        },
      };
    },
  };

  return {
    transport,
    requests,
    acknowledgements,
    get closes() {
      return closes;
    },
    send(frame: HostStreamFrame) {
      receivers.at(-1)!(frame);
    },
    raw(frame: unknown) {
      receivers.at(-1)!(frame);
    },
  };
}

const query = { target: { kind: "resource", resource: "note" } } as const;

describe("platform resumable stream", () => {
  it("receives and acknowledges a maximum-size escaped resource event", async () => {
    const host = fixture();
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query);

    expect(host.requests[0].limits.maxBufferedBytes).toBe(8 * 1024 * 1024);
    const text = "\0".repeat(1024 * 1024);

    host.send({
      type: "event",
      event: {
        ...event(1),
        kind: "resource.changed",
        payload: {
          resource: "note",
          id: "note",
          revision: "2",
          change: "updated",
          fields: { content: text },
        },
      },
    });

    const delivered = await subscription.next();

    expect(delivered.value.kind).toBe("resource.changed");
    await subscription.acknowledge(delivered.value);
    expect(host.acknowledgements).toEqual([cursor(1)]);
    await subscription.close();
  });

  it("keeps the smaller host buffer limit when negotiating a stream", async () => {
    const host = fixture();
    const subscription = await openEventSubscription(
      host.transport,
      "events.subscribe",
      query,
      { maxBufferedBytes: 8 * 1024 * 1024 },
      { maxBufferedBytes: 1024 * 1024 },
    );

    expect(host.requests[0].limits.maxBufferedBytes).toBe(1024 * 1024);
    await subscription.close();
  });

  it("counts the complete event frame at the buffer boundary", async () => {
    const frame: HostStreamFrame = { type: "event", event: event(1) };
    const size = new TextEncoder().encode(JSON.stringify(frame)).byteLength;
    const exact = fixture();
    const subscription = await openEventSubscription(exact.transport, "events.subscribe", query, {
      maxBufferedBytes: size,
    });

    exact.send(frame);
    expect((await subscription.next()).value.cursor.seq).toBe(1);
    await subscription.close();

    const tooSmall = fixture();
    const rejected = await openEventSubscription(tooSmall.transport, "events.subscribe", query, {
      maxBufferedBytes: size - 1,
    });

    tooSmall.send(frame);
    await expect(rejected.next()).rejects.toMatchObject({ code: "buffer_overflow" });
  });

  it("deduplicates replay and acknowledges only processed delivered events", async () => {
    const host = fixture();
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query, {
      after: cursor(0),
    });

    host.send({ type: "event", event: event(1) });
    host.send({ type: "event", event: event(1) });
    host.send({ type: "event", event: event(2) });
    await expect(subscription.acknowledge(event(1))).rejects.toMatchObject({
      code: "invalid_argument",
    });

    const first = await subscription.next();
    const second = await subscription.next();

    expect(first.value.cursor.seq).toBe(1);
    expect(second.value.cursor.seq).toBe(2);
    expect(host.acknowledgements).toEqual([]);
    await subscription.acknowledge(first.value);
    await subscription.acknowledge(second.value);
    expect(subscription.acknowledgedCursor).toEqual(cursor(2));
    expect(host.acknowledgements).toEqual([cursor(1), cursor(2)]);
    await subscription.close();
    expect(host.closes).toBe(1);
  });

  it("requires snapshot recovery after a sequence gap or a new epoch", async () => {
    for (const next of [event(3), event(2, "two")]) {
      const host = fixture();
      const subscription = await openEventSubscription(host.transport, "events.subscribe", query, {
        after: cursor(0),
      });

      host.send({ type: "event", event: event(1) });
      host.send({ type: "event", event: next });
      await expect(subscription.next()).rejects.toMatchObject({ code: "stream_gap" });
      expect(subscription.state).toBe("resyncRequired");
      await subscription.resume(cursor(10, "two"));
      host.send({ type: "event", event: event(11, "two") });
      expect((await subscription.next()).value.cursor.seq).toBe(11);
      await subscription.close();
    }
  });

  it("bounds queued and delivered-but-unacknowledged events", async () => {
    const host = fixture();
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query, {
      maxBufferedEvents: 2,
    });

    host.send({ type: "event", event: event(1) });
    await subscription.next();
    host.send({ type: "event", event: event(2) });
    await subscription.next();
    host.send({ type: "event", event: event(3) });
    await expect(subscription.next()).rejects.toMatchObject({ code: "buffer_overflow" });
    expect(subscription.state).toBe("resyncRequired");
    await subscription.close();
  });

  it("enforces a byte limit and validates host envelopes", async () => {
    const host = fixture();
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query, {
      maxBufferedBytes: 20,
    });

    host.send({ type: "event", event: event(1) });
    await expect(subscription.next()).rejects.toMatchObject({ code: "buffer_overflow" });
    await subscription.resume();
    host.raw({ type: "event", event: { ...event(1), schemaVersion: 99 } });
    await expect(subscription.next()).rejects.toMatchObject({ code: "invalid_host_response" });
    await subscription.close();
  });

  it("resumes after the last acknowledgement and redelivers unprocessed events", async () => {
    const host = fixture();
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query);

    host.send({ type: "event", event: event(1) });
    const first = await subscription.next();

    await subscription.acknowledge(first.value);
    host.send({ type: "event", event: event(2) });
    await subscription.next();
    host.send({ type: "error", error: { code: "host_unavailable", retryable: true } });
    await subscription.resume();
    expect(host.requests[1].query.after).toEqual(cursor(1));
    host.send({ type: "event", event: event(2) });
    expect((await subscription.next()).value.cursor.seq).toBe(2);
    await subscription.close();
  });

  it("exposes transport reconnection without issuing mutations", async () => {
    const host = fixture();
    const states: string[] = [];
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query, {
      onStateChange: (value) => states.push(value),
    });

    host.send({ type: "status", state: "reconnecting" });
    host.send({ type: "status", state: "open" });
    expect(states).toEqual(["connecting", "open", "reconnecting", "open"]);
    expect(host.requests).toHaveLength(1);
    await subscription.close();
  });

  it("aborts pending delivery and ignores frames after explicit close", async () => {
    const host = fixture();
    const controller = new AbortController();
    const subscription = await openEventSubscription(host.transport, "events.subscribe", query, {
      signal: controller.signal,
    });
    const next = subscription.next();

    controller.abort();
    await expect(next).rejects.toMatchObject({ code: "cancelled" });
    await subscription.close();
    host.send({ type: "event", event: event(1) });
    expect(await subscription.next()).toEqual({ done: true, value: undefined });
  });

  it("does not open a transport for an already aborted signal", async () => {
    const host = fixture();
    const controller = new AbortController();

    controller.abort();
    await expect(
      openEventSubscription(host.transport, "events.subscribe", query, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "cancelled" });

    expect(host.requests).toEqual([]);
  });

  it("aborts a pending open promptly and closes a connection that arrives later", async () => {
    const controller = new AbortController();
    let finish!: (connection: HostStreamConnection) => void;
    let closes = 0;
    const started = new Promise<HostStreamConnection>((resolve) => {
      finish = resolve;
    });
    const opening = openEventSubscription(
      { version: 1, open: () => started },
      "events.subscribe",
      query,
      { signal: controller.signal },
    );

    await Promise.resolve();
    controller.abort();
    await expect(opening).rejects.toMatchObject({ code: "cancelled" });
    finish({
      close: async () => {
        closes++;
      },
      acknowledge: async () => {},
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(closes).toBe(1);
  });

  it("does not let an old acknowledgement replace a resumed cursor", async () => {
    let receive!: (frame: unknown) => void;
    let finish!: () => void;
    const transport: HostEventTransport = {
      version: 1,
      open: async (_request, listener) => {
        receive = listener;

        return {
          close: async () => {},
          acknowledge: () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            }),
        };
      },
    };
    const subscription = await openEventSubscription(transport, "events.subscribe", query);

    receive({ type: "event", event: event(1) });
    const first = (await subscription.next()).value;
    const acknowledgement = subscription.acknowledge(first);

    await subscription.resume(cursor(20, "new"));
    finish();
    await expect(acknowledgement).rejects.toMatchObject({ code: "stream_closed" });
    expect(subscription.acknowledgedCursor).toEqual(cursor(20, "new"));
    await subscription.close();
  });
});
