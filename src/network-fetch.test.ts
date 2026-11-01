import { describe, expect, it } from "bun:test";
import type { JsonValue } from "./index";
import { createPluginFetch } from "./network-fetch";

type Call = { method: string; params: JsonValue | undefined };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function metadata(overrides: Record<string, JsonValue> = {}): JsonValue {
  return {
    status: 200,
    statusText: "OK",
    headers: [["content-type", "text/event-stream"]],
    url: "https://api.example.com/v1/chat",
    redirected: false,
    ...overrides,
  };
}

function chunk(value: string | Uint8Array): JsonValue {
  return {
    done: false,
    chunk: Buffer.from(value).toString("base64"),
  };
}

function bridge(
  options: {
    open?: () => Promise<JsonValue> | JsonValue;
    read?: () => Promise<JsonValue> | JsonValue;
  } = {},
) {
  const calls: Call[] = [];

  const call = async (method: string, params?: JsonValue): Promise<JsonValue> => {
    calls.push({ method, params });

    if (method === "network.open") {
      return options.open ? options.open() : metadata();
    }

    if (method === "network.read") {
      return options.read ? options.read() : { done: true };
    }

    if (method === "network.close") {
      return null;
    }

    throw new Error(`Unexpected method: ${method}`);
  };

  return { calls, fetch: createPluginFetch(call) };
}

function params(call: Call): Record<string, JsonValue> {
  return call.params as Record<string, JsonValue>;
}

describe("plugin Fetch adapter", () => {
  it("returns a streaming Response with the host status, headers and final URL", async () => {
    const frames = [chunk("data: first\n\n"), chunk("data: second\n\n"), { done: true }];
    const host = bridge({
      open: () =>
        metadata({
          status: 202,
          statusText: "Accepted",
          url: "https://api.example.com/v2/chat",
          redirected: true,
          headers: [
            ["content-type", "text/event-stream"],
            ["x-request-id", "request-1"],
          ],
        }),
      read: () => frames.shift()!,
    });
    const response = await host.fetch("https://api.example.com/v1/chat");

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(202);
    expect(response.statusText).toBe("Accepted");
    expect(response.url).toBe("https://api.example.com/v2/chat");
    expect(response.redirected).toBe(true);
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(await response.text()).toBe("data: first\n\ndata: second\n\n");
    expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
    expect(new Set(host.calls.map((call) => params(call).id)).size).toBe(1);
  });

  it("serializes a Request and RequestInit overrides without corrupting binary input", async () => {
    const host = bridge();
    const input = new Request("https://api.example.com/v1/chat", {
      method: "POST",
      headers: { "x-original": "old" },
      body: new Uint8Array([0, 127, 128, 255]),
    });
    const response = await host.fetch(input, {
      headers: new Headers({
        Authorization: "Bearer user-key",
        "Content-Type": "application/octet-stream",
      }),
      redirect: "error",
    });

    await response.text();
    const open = params(host.calls.find((call) => call.method === "network.open")!);

    expect(open.url).toBe(input.url);
    expect(open.method).toBe("POST");
    expect(open.redirect).toBe("error");
    expect(open.headers).toEqual([
      ["authorization", "Bearer user-key"],
      ["content-type", "application/octet-stream"],
    ]);

    expect(open.body).toBe("AH+A/w==");
  });

  it("preserves binary response chunks", async () => {
    const frames = [
      chunk(new Uint8Array([0, 255])),
      chunk(new Uint8Array([128, 1])),
      { done: true },
    ];
    const host = bridge({ read: () => frames.shift()! });
    const response = await host.fetch(new URL("https://api.example.com/v1/chat"));

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0, 255, 128, 1]));
  });

  it("returns unsuccessful HTTP statuses as responses instead of transport errors", async () => {
    const frames = [chunk('{"error":"rate_limited"}'), { done: true }];
    const host = bridge({
      open: () =>
        metadata({ status: 429, statusText: "Too Many Requests", headers: [["retry-after", "2"]] }),
      read: () => frames.shift()!,
    });
    const response = await host.fetch("https://api.example.com/v1/chat");

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(await response.json()).toEqual({ error: "rate_limited" });
  });

  it("does not dispatch an already aborted request", async () => {
    const host = bridge();
    const controller = new AbortController();

    controller.abort();

    await expect(
      host.fetch("https://api.example.com/v1/chat", { signal: controller.signal }),
    ).rejects.toHaveProperty("name", "AbortError");

    expect(host.calls).toHaveLength(0);
  });

  it("cancels a pending open without waiting for response headers", async () => {
    const opened = deferred<void>();
    const pending = deferred<JsonValue>();
    const host = bridge({
      open: () => {
        opened.resolve();

        return pending.promise;
      },
    });
    const controller = new AbortController();
    const request = host.fetch("https://api.example.com/v1/chat", { signal: controller.signal });

    await opened.promise;
    controller.abort();

    await expect(request).rejects.toHaveProperty("name", "AbortError");
    expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
    pending.resolve(metadata());
    await Promise.resolve();
    expect(host.calls.some((call) => call.method === "network.read")).toBe(false);
  });

  it("aborts a pending response read and closes its native stream once", async () => {
    const reading = deferred<void>();
    const pending = deferred<JsonValue>();
    const host = bridge({
      read: () => {
        reading.resolve();

        return pending.promise;
      },
    });
    const controller = new AbortController();
    const response = await host.fetch("https://api.example.com/v1/chat", {
      signal: controller.signal,
    });
    const result = response.text();

    await reading.promise;
    controller.abort();

    await expect(result).rejects.toHaveProperty("name", "AbortError");
    expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
    pending.resolve(chunk("late response"));
  });

  it("forwards a custom abort reason", async () => {
    const reading = deferred<void>();
    const pending = deferred<JsonValue>();
    const host = bridge({
      read: () => {
        reading.resolve();

        return pending.promise;
      },
    });
    const controller = new AbortController();
    const response = await host.fetch("https://api.example.com/v1/chat", {
      signal: controller.signal,
    });
    const result = response.text();

    await reading.promise;
    const reason = new Error("User stopped generation");

    controller.abort(reason);

    await expect(result).rejects.toBe(reason);
    pending.resolve({ done: true });
  });

  it("closes native resources when a reader cancels the response", async () => {
    const pending = deferred<JsonValue>();
    const host = bridge({ read: () => pending.promise });
    const response = await host.fetch("https://api.example.com/v1/chat");

    await response.body!.cancel();
    expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
    pending.resolve({ done: true });
  });

  it("closes HEAD and bodyless status responses without reading a stream", async () => {
    for (const [method, status] of [
      ["HEAD", 200],
      ["GET", 204],
      ["GET", 205],
      ["GET", 304],
    ] as const) {
      const host = bridge({ open: () => metadata({ status }) });
      const response = await host.fetch("https://api.example.com/v1/chat", { method });

      expect(response.body).toBeNull();
      expect(await response.text()).toBe("");
      expect(host.calls.map((call) => call.method)).toEqual(["network.open", "network.close"]);
    }
  });

  it("propagates permission failures and closes the attempted request", async () => {
    const failure = new Error("plugin_permission_denied");
    const host = bridge({ open: () => Promise.reject(failure) });

    await expect(host.fetch("https://denied.example.com/")).rejects.toBe(failure);
    expect(host.calls.map((call) => call.method)).toEqual(["network.open", "network.close"]);
  });

  it("rejects malformed response metadata and closes the native request", async () => {
    for (const bad of [
      null,
      metadata({ status: 199 }),
      metadata({ status: 600 }),
      metadata({ headers: [["bad"]] }),
    ]) {
      const host = bridge({ open: () => bad });

      await expect(host.fetch("https://api.example.com/v1/chat")).rejects.toThrow(
        "plugin_invalid_network_response",
      );

      expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
    }
  });

  it("reports malformed frames and transport failures while reading the body", async () => {
    for (const read of [
      () => ({ done: false, chunk: 123 }),
      () => ({ done: "yes" }),
      () => Promise.reject(new Error("plugin_network_failed")),
    ]) {
      const host = bridge({ read });
      const response = await host.fetch("https://api.example.com/v1/chat");

      await expect(response.text()).rejects.toThrow();
      expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
    }
  });

  it("rejects oversized uploads before sending them to the native host", async () => {
    const host = bridge();

    await expect(
      host.fetch("https://api.example.com/v1/chat", {
        method: "POST",
        body: new Uint8Array(2 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow("plugin_input_too_large");

    expect(host.calls).toHaveLength(0);
  });

  it("aborts a stalled request body before opening a network request", async () => {
    const canceled = deferred<void>();
    const reading = deferred<void>();
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull() {
        reading.resolve();
      },
      cancel() {
        canceled.resolve();
      },
    });
    const host = bridge();
    const result = host.fetch("https://api.example.com/v1/chat", {
      method: "POST",
      body,
      signal: controller.signal,
    });

    await reading.promise;
    await Promise.resolve();
    controller.abort();

    await expect(result).rejects.toHaveProperty("name", "AbortError");
    await canceled.promise;
    expect(host.calls).toHaveLength(0);
  });

  it("observes an abort triggered synchronously while dispatching open", async () => {
    const controller = new AbortController();
    const pending = deferred<JsonValue>();
    const host = bridge({
      open: () => {
        controller.abort();

        return pending.promise;
      },
    });
    const result = host.fetch("https://api.example.com/v1/chat", { signal: controller.signal });
    const outcome = await Promise.race([
      result.then(
        () => "resolved",
        (error: unknown) => error,
      ),
      Bun.sleep(50).then(() => "timed out"),
    ]);

    pending.resolve(metadata());
    expect(outcome).toHaveProperty("name", "AbortError");
    expect(host.calls.filter((call) => call.method === "network.close")).toHaveLength(1);
  });

  it("rejects oversized streaming Requests without waiting for the original body branch", async () => {
    const host = bridge();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
      },
    });
    const input = new Request("https://api.example.com/v1/chat", { method: "POST", body });
    const result = host.fetch(input);
    const outcome = await Promise.race([
      result.then(
        () => "resolved",
        (error: unknown) => error,
      ),
      Bun.sleep(50).then(() => "timed out"),
    ]);

    expect(outcome).toHaveProperty("message", "plugin_input_too_large");
    expect(host.calls).toHaveLength(0);
  });

  it("queues simultaneous abort cleanup across adapters sharing the same bridge", async () => {
    let activeCloses = 0;
    let maxActiveCloses = 0;
    const closed = new Set<string>();
    const allClosed = deferred<void>();
    const pendingReads = new Map<string, ReturnType<typeof deferred<JsonValue>>>();

    const call = async (method: string, value?: JsonValue): Promise<JsonValue> => {
      const id = (value as { id: string }).id;

      if (method === "network.open") {
        return metadata();
      }

      if (method === "network.read") {
        const read = deferred<JsonValue>();

        pendingReads.set(id, read);

        return read.promise;
      }

      if (method === "network.close") {
        if (activeCloses >= 2) {
          throw new Error("plugin_busy");
        }

        activeCloses += 1;
        maxActiveCloses = Math.max(maxActiveCloses, activeCloses);
        await Bun.sleep(1);
        activeCloses -= 1;
        closed.add(id);
        pendingReads.get(id)?.resolve({ done: true });

        if (closed.size === 8) {
          allClosed.resolve();
        }

        return null;
      }

      throw new Error("Unexpected host call");
    };

    const controllers = Array.from({ length: 8 }, () => new AbortController());
    const responses = await Promise.all(
      controllers.map((controller) =>
        createPluginFetch(call)("https://api.example.com/v1/chat", { signal: controller.signal }),
      ),
    );
    const results = responses.map((response) => response.text().catch((error: unknown) => error));

    controllers.forEach((controller) => controller.abort());
    await Promise.race([allClosed.promise, Bun.sleep(500)]);
    expect(closed.size).toBe(8);
    expect(maxActiveCloses).toBe(1);
    expect(
      (await Promise.all(results)).every(
        (result) => result instanceof DOMException && result.name === "AbortError",
      ),
    ).toBe(true);
  });

  it("retries a busy control bridge when canceling a response", async () => {
    let attempts = 0;
    const pending = deferred<JsonValue>();
    const fetch = createPluginFetch(async (method) => {
      if (method === "network.open") {
        return metadata();
      }

      if (method === "network.read") {
        return pending.promise;
      }

      if (method === "network.close") {
        attempts += 1;

        if (attempts < 3) {
          throw Object.assign(new Error("Control queue is busy"), { code: "plugin_busy" });
        }

        pending.resolve({ done: true });

        return null;
      }

      throw new Error("Unexpected host call");
    });
    const response = await fetch("https://api.example.com/v1/chat");

    await response.body!.cancel();
    expect(attempts).toBe(3);
  });
});
