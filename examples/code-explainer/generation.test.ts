import { describe, expect, it } from "bun:test";
import type { PluginFetch } from "../../src";
import { ExplanationRun, explanationPrompt } from "./generation";

const settings = {
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "test-key",
  model: "test-model",
};
const frame = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

function response(text: string, split = false) {
  const bytes = new TextEncoder().encode(text);

  return new Response(
    new ReadableStream({
      start(controller) {
        if (split) {
          for (const byte of bytes) {
            controller.enqueue(new Uint8Array([byte]));
          }
        } else {
          controller.enqueue(bytes);
        }

        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("direct provider code explanation", () => {
  it("sends the configured model and key through the supplied fetch", async () => {
    let input: RequestInfo | URL | undefined;
    let options: RequestInit | undefined;
    const run = new ExplanationRun(
      async (url, init) => {
        input = url;
        options = init;

        return response(frame("Hello") + "data: [DONE]\n\n");
      },
      () => {},
    );

    await run.start("const a = 1;", "Explain a", "en", settings);
    expect(input).toBe(settings.endpoint);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-key");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: "test-model",
      stream: true,
      max_tokens: 2048,
    });

    expect(run.state).toEqual({ phase: "completed", text: "Hello" });
  });

  it("decodes UTF-8 and SSE boundaries split between chunks", async () => {
    const run = new ExplanationRun(
      async () => response(frame("Привет") + frame(" мир") + "data: [DONE]\n\n", true),
      () => {},
    );

    await run.start("code", "", "ru", settings);
    expect(run.state).toEqual({ phase: "completed", text: "Привет мир" });
  });

  it("retains partial output when the connection ends without completion", async () => {
    const run = new ExplanationRun(
      async () => response(frame("partial")),
      () => {},
    );

    await run.start("code", "", "en", settings);
    expect(run.state).toEqual({ phase: "failed", text: "partial", error: "response_interrupted" });
  });

  it("cancels opening without issuing another provider request", async () => {
    let calls = 0;

    const fetch: PluginFetch = async (_url, init) => {
      calls++;

      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }),
      );
    };

    const run = new ExplanationRun(fetch, () => {});
    const pending = run.start("code", "", "en", settings);

    run.cancel();
    await pending;
    expect(run.state.phase).toBe("cancelled");
    expect(calls).toBe(1);
  });

  it("does not forward URLs outside the declared domains or empty credentials", async () => {
    let calls = 0;
    const run = new ExplanationRun(
      async () => {
        calls++;

        return response("");
      },
      () => {},
    );

    await run.start("code", "", "en", { ...settings, endpoint: "https://example.com/api" });
    expect(run.state.error).toBe("invalid_endpoint");
    await run.start("code", "", "en", { ...settings, apiKey: "" });
    expect(run.state.error).toBe("missing_api_key");
    expect(calls).toBe(0);
  });

  it("reports HTTP status without exposing the provider error body", async () => {
    const run = new ExplanationRun(
      async () => new Response("private diagnostic", { status: 401 }),
      () => {},
    );

    await run.start("code", "", "en", settings);
    expect(run.state.error).toBe("provider_http_401");
    expect(JSON.stringify(run.state)).not.toContain("private diagnostic");
  });

  it("stops notifications when the page is disposed", async () => {
    let complete!: (value: Response) => void;
    const changes: string[] = [];
    const run = new ExplanationRun(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
      (state) => changes.push(state.phase),
    );
    const pending = run.start("code", "", "en", settings);

    run.dispose();
    complete(response(frame("late") + "data: [DONE]\n\n"));
    await pending;
    expect(changes).toEqual(["starting"]);
  });

  it("bounds prompts before making a request", () => {
    expect(() => explanationPrompt("", "", "en")).toThrow("invalid_argument");
    expect(() => explanationPrompt("x".repeat(32_001), "", "en")).toThrow("invalid_argument");
    expect(explanationPrompt("code", "question", "en")).toContain(
      JSON.stringify({ question: "question", code: "code" }),
    );
  });
});
