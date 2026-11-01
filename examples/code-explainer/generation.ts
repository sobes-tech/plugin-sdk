import type { PluginFetch } from "../../src";
import { manifest } from "./manifest";

export const MAX_CODE_LENGTH = 32_000;
const MAX_ANSWER_LENGTH = 256_000;
const MAX_FRAME_LENGTH = 256_000;

export type Phase = "idle" | "starting" | "running" | "completed" | "cancelled" | "failed";

export interface ExplanationState {
  phase: Phase;
  text: string;
  error?: string;
}

export interface ProviderSettings {
  endpoint: string;
  apiKey: string;
  model: string;
}

export function explanationPrompt(code: string, question: string, locale: "en" | "ru"): string {
  if (!code.trim() || code.length > MAX_CODE_LENGTH || question.length > 1000) {
    throw new Error("invalid_argument");
  }

  const instruction =
    locale === "ru"
      ? "Объясни код по-русски. Опиши назначение и ключевые части, укажи возможные ошибки. Если не хватает контекста, скажи об этом. Не выполняй код. Ответ оформляй в Markdown."
      : "Explain the code in English. Describe its purpose and important parts, then point out possible bugs. Say when context is missing. Do not execute the code. Use Markdown.";

  return `${instruction}\n\n${JSON.stringify({ question: question.trim(), code })}`;
}

function validate(settings: ProviderSettings) {
  let url: URL;

  try {
    url = new URL(settings.endpoint);
  } catch {
    throw new Error("invalid_endpoint");
  }

  if (
    url.protocol !== "https:" ||
    !manifest.networkDomains.includes(url.hostname) ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password
  ) {
    throw new Error("invalid_endpoint");
  }

  if (!settings.apiKey.trim() || settings.apiKey.length > 4096) {
    throw new Error("missing_api_key");
  }

  if (!settings.model.trim() || settings.model.length > 128) {
    throw new Error("missing_model");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A single direct provider request. Cancellation does not create a second request. */
export class ExplanationRun {
  state: ExplanationState = { phase: "idle", text: "" };

  private controller?: AbortController;

  private epoch = 0;

  private disposed = false;

  constructor(
    private fetch: PluginFetch,
    private changed: (state: ExplanationState) => void,
  ) {}

  private update(state: ExplanationState) {
    this.state = state;

    if (!this.disposed) {
      this.changed(state);
    }
  }

  async start(code: string, question: string, locale: "en" | "ru", settings: ProviderSettings) {
    if (this.disposed || this.controller) {
      return;
    }

    const epoch = ++this.epoch;
    const controller = new AbortController();

    this.controller = controller;
    this.update({ phase: "starting", text: "" });
    const current = () => !this.disposed && this.epoch === epoch;
    const timer = setTimeout(() => controller.abort(new Error("request_timeout")), 600_000);

    try {
      validate(settings);
      const prompt = explanationPrompt(code, question, locale);
      const response = await this.fetch(settings.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: settings.model.trim(),
          messages: [{ role: "user", content: prompt }],
          stream: true,
          max_tokens: 2048,
        }),
      });

      controller.signal.throwIfAborted();

      if (!current()) {
        return;
      }

      if (!response.ok) {
        void response.body?.cancel().catch(() => {});

        throw new Error(`provider_http_${response.status}`);
      }

      if (!response.body) {
        throw new Error("empty_response");
      }

      this.update({ phase: "running", text: "" });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let complete = false;

      const accept = (frame: string) => {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (!data) {
          return;
        }

        if (data === "[DONE]") {
          complete = true;

          return;
        }

        const value: unknown = JSON.parse(data);

        if (!record(value) || value.error) {
          throw new Error("provider_error");
        }

        const choice = Array.isArray(value.choices) ? value.choices[0] : undefined;

        if (!record(choice)) {
          return;
        }

        if (choice.finish_reason) {
          complete = true;
        }

        const delta = record(choice.delta) ? choice.delta.content : undefined;

        if (typeof delta !== "string") {
          return;
        }

        if (this.state.text.length + delta.length > MAX_ANSWER_LENGTH) {
          throw new Error("answer_too_large");
        }

        if (current()) {
          this.update({ phase: "running", text: this.state.text + delta });
        }
      };

      try {
        while (!complete) {
          const part = await reader.read();

          controller.signal.throwIfAborted();

          if (!current()) {
            return;
          }

          pending += decoder.decode(part.value, { stream: !part.done });
          let boundary: RegExpExecArray | null;

          while ((boundary = /\r?\n\r?\n/.exec(pending))) {
            const frame = pending.slice(0, boundary.index);

            pending = pending.slice(boundary.index + boundary[0].length);
            accept(frame);

            if (complete) {
              break;
            }
          }

          if (!complete && pending.length > MAX_FRAME_LENGTH) {
            throw new Error("response_frame_too_large");
          }

          if (part.done) {
            if (pending.trim()) {
              accept(pending);
            }

            break;
          }
        }

        if (!complete) {
          throw new Error("response_interrupted");
        }
      } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }

      if (current()) {
        this.update({ phase: "completed", text: this.state.text });
      }
    } catch (error) {
      if (current()) {
        this.update({
          ...this.state,
          phase: controller.signal.aborted ? "cancelled" : "failed",
          ...(controller.signal.aborted
            ? {}
            : { error: error instanceof Error ? error.message : "provider_error" }),
        });
      }
    } finally {
      clearTimeout(timer);

      if (this.epoch === epoch) {
        this.controller = undefined;
      }
    }
  }

  cancel() {
    this.controller?.abort();

    if (!this.disposed && this.controller) {
      this.update({ phase: "cancelled", text: this.state.text });
    }
  }

  dispose() {
    this.disposed = true;
    this.epoch++;
    this.controller?.abort();
    this.controller = undefined;
  }
}
