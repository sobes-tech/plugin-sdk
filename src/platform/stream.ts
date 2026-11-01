import type { JsonValue } from "../index";
import { pluginApiError, normalizePluginApiError, type PluginApiError } from "./errors";
import type {
  PlatformEventKind,
  EventQuery,
  PlatformEvent,
  PublicError,
  StreamCursor,
} from "./types";

export interface HostStreamConnection {
  acknowledge(cursor: StreamCursor): Promise<void>;
  close(): Promise<void>;
}

export type HostStreamFrame =
  | { type: "event"; event: PlatformEvent }
  | { type: "status"; state: "open" | "reconnecting" }
  | { type: "resyncRequired"; reason: "retention_expired" | "epoch_changed" | "buffer_overflow" }
  | { type: "error"; error: PublicError }
  | { type: "closed" };

/** The host delivers local events. No account or capability token crosses this interface. */
export interface HostEventTransport {
  version: 1;
  open(
    request: {
      method: string;
      query: EventQuery;
      limits: { maxBufferedEvents: number; maxBufferedBytes: number };
    },
    receive: (frame: unknown) => void,
  ): Promise<HostStreamConnection>;
}

export interface PluginApiBridge {
  call(method: string, params?: JsonValue): Promise<JsonValue>;
  events?: HostEventTransport;
}

export type SubscriptionState =
  "connecting" | "open" | "reconnecting" | "resyncRequired" | "failed" | "closed";

export interface SubscriptionOptions {
  after?: StreamCursor;
  signal?: AbortSignal;
  maxBufferedEvents?: number;
  maxBufferedBytes?: number;
  onStateChange?: (state: SubscriptionState) => void;
}

export interface EventSubscription extends AsyncIterableIterator<PlatformEvent> {
  readonly state: SubscriptionState;
  readonly acknowledgedCursor: StreamCursor | undefined;
  /** Cumulative acknowledgement after durable handling; it must refer to a delivered event. */
  acknowledge(event: PlatformEvent): Promise<void>;
  /** Reopens only the subscription. It never repeats a resource mutation. */
  resume(after?: StreamCursor): Promise<void>;
  close(): Promise<void>;
}

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isStreamCursor(value: unknown): value is StreamCursor {
  return (
    record(value) &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    typeof value.streamId === "string" &&
    value.streamId.length > 0 &&
    typeof value.epoch === "string" &&
    value.epoch.length > 0 &&
    Number.isSafeInteger(value.seq) &&
    (value.seq as number) >= 0
  );
}

const eventKinds: readonly PlatformEventKind[] = [
  "message.changed",
  "transcript.partial",
  "transcript.final",
  "resource.changed",
];

function isEvent(value: unknown): value is PlatformEvent {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !isStreamCursor(value.cursor) ||
    typeof value.eventId !== "string" ||
    typeof value.time !== "string" ||
    value.authority !== "host-local" ||
    !eventKinds.includes(value.kind as PlatformEventKind) ||
    !record(value.payload)
  ) {
    return false;
  }

  const p = value.payload;

  switch (value.kind) {
    case "message.changed":
      return (
        typeof p.meetingId === "string" &&
        typeof p.messageId === "string" &&
        typeof p.revision === "string" &&
        record(p.fields)
      );
    case "transcript.partial":
    case "transcript.final":
      return (
        typeof p.meetingId === "string" &&
        typeof p.segmentId === "string" &&
        typeof p.revision === "string" &&
        typeof p.text === "string"
      );
    case "resource.changed":
      return (
        typeof p.resource === "string" &&
        typeof p.id === "string" &&
        typeof p.revision === "string" &&
        ["created", "updated", "moved", "trashed", "restored"].includes(String(p.change))
      );
    default:
      return false;
  }
}

function bytes(value: unknown): number {
  let count = 0;

  for (const char of JSON.stringify(value)) {
    const code = char.codePointAt(0)!;

    count += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }

  return count;
}

function waitForConnection(
  opening: Promise<HostStreamConnection>,
  signal?: AbortSignal,
): Promise<HostStreamConnection> {
  if (!signal) {
    return opening;
  }

  return new Promise((resolve, reject) => {
    let aborted = false;

    const abort = () => {
      aborted = true;
      signal.removeEventListener("abort", abort);
      reject(pluginApiError("cancelled"));
    };

    signal.addEventListener("abort", abort, { once: true });

    if (signal.aborted) {
      abort();
    }

    opening.then(
      (connection) => {
        signal.removeEventListener("abort", abort);

        if (aborted) {
          void connection.close().catch(() => {});
        } else {
          resolve(connection);
        }
      },
      (error) => {
        signal.removeEventListener("abort", abort);

        if (!aborted) {
          reject(error);
        }
      },
    );
  });
}

class Subscription implements EventSubscription {
  state: SubscriptionState = "connecting";

  acknowledgedCursor: StreamCursor | undefined;

  private received?: StreamCursor;

  private connection?: HostStreamConnection;

  private epoch = 0;

  private error?: PluginApiError;

  private ended = false;

  private queue: PlatformEvent[] = [];

  private retained = new Map<string, { event: PlatformEvent; bytes: number; delivered: boolean }>();

  private bufferedBytes = 0;

  private pending?: {
    resolve: (value: IteratorResult<PlatformEvent>) => void;
    reject: (error: unknown) => void;
  };

  private readonly aborted = () => this.fail(pluginApiError("cancelled"));

  constructor(
    private transport: HostEventTransport,
    private method: string,
    private query: EventQuery,
    private options: SubscriptionOptions,
    private limits: { maxBufferedEvents: number; maxBufferedBytes: number },
  ) {}

  [Symbol.asyncIterator](): AsyncIterableIterator<PlatformEvent> {
    return this;
  }

  private status(state: SubscriptionState) {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private fail(error: PluginApiError) {
    this.error = error;
    this.queue = [];
    this.retained.clear();
    this.bufferedBytes = 0;
    this.status(
      error.code === "stream_gap" || error.code === "buffer_overflow" ? "resyncRequired" : "failed",
    );

    this.pending?.reject(error);
    this.pending = undefined;
    this.options.signal?.removeEventListener("abort", this.aborted);
    const connection = this.connection;

    this.connection = undefined;
    void connection?.close().catch(() => {});
  }

  private receive(frame: unknown) {
    if (this.ended || this.error) {
      return;
    }

    if (!record(frame)) {
      this.fail(pluginApiError("invalid_host_response"));

      return;
    }

    if (frame.type === "status" && (frame.state === "open" || frame.state === "reconnecting")) {
      this.status(frame.state);

      return;
    }

    if (frame.type === "resyncRequired") {
      this.fail(pluginApiError("stream_gap"));

      return;
    }

    if (frame.type === "error") {
      this.fail(normalizePluginApiError(frame.error));

      return;
    }

    if (frame.type === "closed") {
      this.ended = true;
      this.options.signal?.removeEventListener("abort", this.aborted);
      this.status("closed");
      this.pending?.resolve({ done: true, value: undefined });
      this.pending = undefined;

      return;
    }

    if (
      frame.type !== "event" ||
      !isEvent(frame.event) ||
      (this.query.kinds && !this.query.kinds.includes(frame.event.kind))
    ) {
      this.fail(pluginApiError("invalid_host_response"));

      return;
    }

    const event = frame.event;
    const cursor = event.cursor;

    if (this.received) {
      if (cursor.streamId !== this.received.streamId || cursor.epoch !== this.received.epoch) {
        this.fail(pluginApiError("stream_gap"));

        return;
      }

      if (cursor.seq <= this.received.seq) {
        return;
      }

      if (cursor.seq !== this.received.seq + 1) {
        this.fail(pluginApiError("stream_gap"));

        return;
      }
    }

    let size: number;

    try {
      size = bytes(frame);
    } catch {
      this.fail(pluginApiError("invalid_host_response"));

      return;
    }

    if (
      this.retained.size >= this.limits.maxBufferedEvents ||
      this.bufferedBytes + size > this.limits.maxBufferedBytes
    ) {
      this.fail(pluginApiError("buffer_overflow"));

      return;
    }

    this.received = cursor;
    this.retained.set(cursor.token, { event, bytes: size, delivered: !!this.pending });
    this.bufferedBytes += size;

    if (this.pending) {
      this.pending.resolve({ value: event, done: false });
      this.pending = undefined;
    } else {
      this.queue.push(event);
    }
  }

  async open(after = this.acknowledgedCursor): Promise<void> {
    if (this.options.signal?.aborted) {
      throw pluginApiError("cancelled");
    }

    if (after !== undefined && !isStreamCursor(after)) {
      throw pluginApiError("invalid_argument");
    }

    const epoch = ++this.epoch;

    await this.connection?.close();

    if (epoch !== this.epoch) {
      throw pluginApiError("stream_closed");
    }

    this.connection = undefined;
    this.ended = false;
    this.error = undefined;
    this.queue = [];
    this.retained.clear();
    this.bufferedBytes = 0;
    this.pending?.reject(pluginApiError("stream_closed"));
    this.pending = undefined;
    this.received = this.acknowledgedCursor = after;
    this.status("connecting");
    this.options.signal?.addEventListener("abort", this.aborted, { once: true });

    try {
      const opening = this.transport.open(
        { method: this.method, query: { ...this.query, after }, limits: this.limits },
        (frame) => {
          if (this.epoch === epoch) {
            this.receive(frame);
          }
        },
      );
      const connection = await waitForConnection(opening, this.options.signal);

      if (this.epoch !== epoch || this.ended || this.error) {
        await connection.close();

        if (this.error) {
          throw this.error;
        }

        return;
      }

      this.connection = connection;

      if (this.state === "connecting") {
        this.status("open");
      }
    } catch (error) {
      const normalized = normalizePluginApiError(error);

      this.fail(normalized);

      throw normalized;
    }
  }

  async next(): Promise<IteratorResult<PlatformEvent>> {
    if (this.error) {
      throw this.error;
    }

    const value = this.queue.shift();

    if (value) {
      this.retained.get(value.cursor.token)!.delivered = true;

      return { value, done: false };
    }

    if (this.ended) {
      return { value: undefined, done: true };
    }

    if (this.pending) {
      throw pluginApiError("invalid_argument", "Only one pending next() is supported");
    }

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }

  async acknowledge(event: PlatformEvent): Promise<void> {
    const cursor = event.cursor;
    const entry = this.retained.get(cursor.token);

    if (
      !entry?.delivered ||
      entry.event.eventId !== event.eventId ||
      !this.connection ||
      this.error
    ) {
      throw pluginApiError("invalid_argument");
    }

    const epoch = this.epoch;

    try {
      await this.connection.acknowledge(cursor);
    } catch (error) {
      throw normalizePluginApiError(error);
    }

    if (this.epoch !== epoch) {
      throw pluginApiError("stream_closed");
    }

    if (this.acknowledgedCursor && cursor.seq <= this.acknowledgedCursor.seq) {
      return;
    }

    this.acknowledgedCursor = cursor;

    for (const [key, retained] of this.retained) {
      if (retained.event.cursor.seq <= cursor.seq) {
        this.bufferedBytes -= retained.bytes;
        this.retained.delete(key);
      }
    }
  }

  async resume(after?: StreamCursor): Promise<void> {
    await this.open(after);
  }

  async close(): Promise<void> {
    ++this.epoch;
    const connection = this.connection;

    this.connection = undefined;
    this.ended = true;
    this.error = undefined;
    this.queue = [];
    this.retained.clear();
    this.bufferedBytes = 0;
    this.options.signal?.removeEventListener("abort", this.aborted);
    this.pending?.resolve({ value: undefined, done: true });
    this.pending = undefined;
    this.status("closed");

    try {
      await connection?.close();
    } catch (error) {
      throw normalizePluginApiError(error);
    }
  }

  async return(): Promise<IteratorResult<PlatformEvent>> {
    await this.close();

    return { value: undefined, done: true };
  }
}

export async function openEventSubscription(
  transport: HostEventTransport,
  method: string,
  query: EventQuery,
  options: SubscriptionOptions = {},
  hostLimits: { maxBufferedEvents?: number; maxBufferedBytes?: number } = {},
): Promise<EventSubscription> {
  const limit = (provided: number | undefined, allowed: number | undefined, fallback: number) => {
    const value = Math.min(provided ?? fallback, allowed ?? fallback);

    if (!Number.isSafeInteger(value) || value < 1) {
      throw pluginApiError("invalid_argument");
    }

    return value;
  };

  const subscription = new Subscription(transport, method, query, options, {
    maxBufferedEvents: limit(options.maxBufferedEvents, hostLimits.maxBufferedEvents, 64),
    maxBufferedBytes: limit(options.maxBufferedBytes, hostLimits.maxBufferedBytes, 8 * 1024 * 1024),
  });

  await subscription.open(options.after ?? query.after);

  return subscription;
}
