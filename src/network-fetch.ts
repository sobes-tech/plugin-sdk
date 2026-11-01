import type { JsonValue } from "./index";

export type PluginFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type Call = (method: string, params?: JsonValue) => Promise<JsonValue>;

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const MAX_PENDING_CLOSES = 64;
const CLOSE_RETRY_MS = 100;
const CLOSE_DEADLINE_MS = 30_000;

type PendingClose = {
  id: string;
  resolve: () => void;
  reject: (error: unknown) => void;
};

type CloseQueue = { running: boolean; pending: PendingClose[] };

const closeQueues = new WeakMap<Call, CloseQueue>();

function isBusy(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return error === "plugin_busy";
  }

  return (
    ("code" in error && error.code === "plugin_busy") ||
    ("message" in error && error.message === "plugin_busy")
  );
}

async function sendClose(call: Call, id: string): Promise<void> {
  const deadline = Date.now() + CLOSE_DEADLINE_MS;

  while (true) {
    try {
      await call("network.close", { id });

      return;
    } catch (error) {
      if (!isBusy(error) || Date.now() >= deadline) {
        throw error;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, CLOSE_RETRY_MS));
    }
  }
}

async function drainCloseQueue(call: Call, queue: CloseQueue): Promise<void> {
  queue.running = true;

  while (queue.pending.length > 0) {
    const request = queue.pending[0];

    try {
      await sendClose(call, request.id);
      request.resolve();
    } catch (error) {
      request.reject(error);
    }

    queue.pending.shift();
  }

  queue.running = false;
}

function closeRequest(call: Call, id: string): Promise<void> {
  let queue = closeQueues.get(call);

  if (!queue) {
    queue = { running: false, pending: [] };
    closeQueues.set(call, queue);
  }

  if (queue.pending.length >= MAX_PENDING_CLOSES) {
    return Promise.reject(new Error("plugin_busy"));
  }

  return new Promise<void>((resolve, reject) => {
    queue.pending.push({ id, resolve, reject });

    if (!queue.running) {
      void drainCloseQueue(call, queue);
    }
  });
}

function encode(bytes: Uint8Array): string {
  let text = "";

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }

  return btoa(text);
}

function decode(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

function record(value: JsonValue): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("plugin_invalid_network_response");
  }

  return value;
}

async function readBody(request: Request): Promise<string | null> {
  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  const cancel = () => {
    void reader.cancel(request.signal.reason).catch(() => {});
  };

  request.signal.addEventListener("abort", cancel, { once: true });

  try {
    while (true) {
      request.signal.throwIfAborted();

      const part = await reader.read();

      request.signal.throwIfAborted();

      if (part.done) {
        break;
      }

      size += part.value.byteLength;

      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});

        throw new Error("plugin_input_too_large");
      }

      chunks.push(part.value);
    }
  } finally {
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return encode(bytes);
}

/** A browser Fetch adapter whose HTTP requests run through the permitted host bridge. */
export function createPluginFetch(call: Call): PluginFetch {
  return async (input, init) => {
    if (typeof Request === "undefined" || typeof Response === "undefined") {
      throw new Error("plugin_fetch_requires_web_apis");
    }

    const request = new Request(input, init);

    request.signal.throwIfAborted();

    const body = await readBody(request);
    const id = crypto.randomUUID();
    let closed = false;
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;

    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      request.signal.removeEventListener("abort", abort);
      await closeRequest(call, id);
    };

    const abort = () => {
      controller?.error(request.signal.reason);
      controller = undefined;
      void close().catch(() => {});
    };

    request.signal.addEventListener("abort", abort, { once: true });

    try {
      request.signal.throwIfAborted();

      const opening = call("network.open", {
        id,
        url: request.url,
        method: request.method,
        headers: Array.from(request.headers.entries()),
        body,
        redirect: request.redirect,
      });

      const metadata = record(
        await new Promise<JsonValue>((resolve, reject) => {
          const rejectAbort = () => reject(request.signal.reason);

          if (request.signal.aborted) {
            rejectAbort();
          } else {
            request.signal.addEventListener("abort", rejectAbort, { once: true });
          }

          opening.then(resolve, reject).finally(() => {
            request.signal.removeEventListener("abort", rejectAbort);
          });
        }),
      );

      request.signal.throwIfAborted();

      if (
        typeof metadata.status !== "number" ||
        !Number.isInteger(metadata.status) ||
        metadata.status < 200 ||
        metadata.status > 599 ||
        typeof metadata.statusText !== "string" ||
        typeof metadata.url !== "string" ||
        typeof metadata.redirected !== "boolean" ||
        !Array.isArray(metadata.headers) ||
        metadata.headers.some(
          (pair) =>
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            pair.some((part) => typeof part !== "string"),
        )
      ) {
        throw new Error("plugin_invalid_network_response");
      }

      const noBody = request.method === "HEAD" || [204, 205, 304].includes(metadata.status);
      const stream = noBody
        ? null
        : new ReadableStream<Uint8Array>({
            start(value) {
              controller = value;
            },
            async pull(value) {
              try {
                const frame = record(await call("network.read", { id }));

                if (closed) {
                  return;
                }

                request.signal.throwIfAborted();

                if (frame.done === true) {
                  controller = undefined;
                  value.close();
                  await close();
                } else if (frame.done === false && typeof frame.chunk === "string") {
                  value.enqueue(decode(frame.chunk));
                } else {
                  throw new Error("plugin_invalid_network_response");
                }
              } catch (error) {
                if (!closed) {
                  value.error(error);
                }

                controller = undefined;
                await close().catch(() => {});
              }
            },
            async cancel() {
              controller = undefined;
              await close();
            },
          });

      const response = new Response(stream, {
        status: metadata.status,
        statusText: metadata.statusText,
        headers: metadata.headers as [string, string][],
      });

      Object.defineProperties(response, {
        url: { value: metadata.url },
        redirected: { value: metadata.redirected },
      });

      if (noBody) {
        await close();
      }

      return response;
    } catch (error) {
      await close().catch(() => {});

      throw error;
    }
  };
}
