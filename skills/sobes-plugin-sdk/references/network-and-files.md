# HTTP, model requests and private files

## Provider configuration

The plugin owns its model integration. Declare settings for endpoint, API key and model. Use a string `default` with `inputType: "url"`, `"password"` or `"text"` respectively. Keep real credentials out of defaults, source, logs and examples. A password field masks the UI; settings still live in local plaintext JSON.

Request `network.request`. An exact `networkDomains` hostname permits only that host. `*.example.com` permits one or more subdomain labels but not `example.com`. `*` permits all public HTTPS destinations and is appropriate when arbitrary endpoints are part of the requested feature. Each redirect is checked again. There are no partial globs such as `api.*.com`.

Wildcards do not allow local/private IPs, HTTP, non-443 ports or credentials in a URL. A local Ollama endpoint is therefore not reachable through the current network API. Do not work around this by importing Tauri or opening a direct iframe connection.

## Fetch-compatible requests

Use the root SDK export `createPluginFetch` in React:

```ts
import { createPluginFetch } from "@sobes-tech/plugin-sdk";
import type { ReactPluginContext } from "@sobes-tech/plugin-sdk/react";

export async function requestModel(
  plugin: ReactPluginContext,
  messages: { role: "user" | "assistant"; content: string }[],
  signal: AbortSignal,
) {
  const endpoint = String(plugin.settings.endpoint ?? "");
  const apiKey = String(plugin.settings.apiKey ?? "");
  const model = String(plugin.settings.model ?? "");

  if (!endpoint || !apiKey || !model) {
    throw new Error(plugin.locale === "ru"
      ? "Укажите URL, API-ключ и модель в настройках плагина."
      : "Set the endpoint, API key and model in plugin settings.");
  }

  const response = await createPluginFetch(plugin.api)(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Provider HTTP ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}
```

This example assumes an OpenAI-compatible chat-completions provider. Validate its response before rendering; it is not the contract for every model API. Pass an explicit `AbortController.signal` and cancel on unmount, setting changes, user cancellation or replacement by a newer request. If a library accepts a custom fetch function, pass `createPluginFetch(plugin.api)` through that option and bundle the library. For example, `@ai-sdk/openai` accepts it in `createOpenAI({ apiKey, baseURL, fetch })`.

Streaming uses the response `ReadableStream`. Decode chunks incrementally, retain partial UTF-8 and partial SSE lines, and handle the provider's completion/error frames. Do not parse each network chunk as complete JSON. Consume or cancel the body so it does not hold a request slot. A 401 or 429 is a resolved HTTP response; network and permission failures reject the promise. Do not blindly retry requests that may already have incurred a provider charge.

Current adapter limits: 2 MiB upload, 16 MiB response, 10-minute total deadline, 8 concurrent requests per installation. Consult [network.md](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/network.md) before relying on further transport behavior. A QuickJS worker lacks browser `Request`/`Response`; use its bounded core `network.request` helper for small text requests instead.

## Persist plugin data

`usePlugin().storage` is a native account-and-installation-scoped key/value store, not browser `localStorage`. Its complete map is limited to 256 KiB and 256 keys. A TypeScript generic on `get` does not validate loaded JSON.

For larger structured state, use the installation's own files:

```ts
const saved = await plugin.files.readJson("draft.json");

const text = saved !== null && typeof saved === "object" && !Array.isArray(saved)
  && typeof saved.text === "string"
  ? saved.text
  : "";

await plugin.files.writeJson("draft.json", { text: nextText });
const entries = await plugin.files.list();
```

`plugin.files` and `plugin.storage` are implicit; do not add `plugin.files` or `plugin.storage` to `manifest.permissions`. The folder is managed by the host. Filenames are flat and end with `.json`; no directories, absolute paths, parent traversal or delete operation. Limits are 4 MiB per document, 1,024 files and 32 MiB total.

Writes atomically replace a whole file. Serialize read-modify-write operations; there is no transaction or compare-and-swap. A failure during durability sync may occur after replacement, so reread before retrying an uncertain write. Store a schema version in durable data and validate it on load. Files are plaintext, not a vault.

For user-chosen files outside that folder, request `files.userSelected` and call `files.openJson()` or `files.saveJson(filename, value)` directly from a real user interaction. These pickers work in main-window React views only, not overlay panels or workers. Each call grants one selected file, not a reusable path or access to its siblings. If an overlay needs export, offer a main-window plugin page with the picker rather than claiming the overlay can open it.

Use [the JSON file reference](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/api.md#json-files) for filename rules, cancellation values and error codes.
