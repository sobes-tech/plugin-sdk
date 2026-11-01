# Requests to model providers

[Documentation](README.md) · [Русский](../ru/model-requests.md)

A plugin calls its own provider through [`createPluginFetch`](network.md). It supplies the URL, API key, model and request body. The SDK does not supply provider credentials, a provider chooser or a generation service.

## Provider settings

Declare settings on the plugin manifest and read them through `usePlugin().settings`:

```ts
settings: [
  { id: "endpoint", title: { en: "API URL", ru: "URL API" }, default: "https://api.openai.com/v1", inputType: "url" },
  { id: "apiKey", title: { en: "API key", ru: "API-ключ" }, default: "", inputType: "password" },
  { id: "model", title: { en: "Model ID", ru: "ID модели" }, default: "gpt-4.1-mini" },
],
permissions: ["ui.render", "network.request"],
networkDomains: ["*"],
```

`password` masks the input field. Settings are stored in local JSON without encryption; it does not turn the setting into a vault secret. Keep real keys out of source code, bundle defaults, logs and request URLs.

This example uses `networkDomains: ["*"]` so the user can select any public HTTPS provider through the URL setting. For a plugin tied to specific servers, use exact hostnames or a subdomain wildcard such as `*.example.com` instead. The user approves the declared access; a settings value cannot widen it. Private and loopback IPs remain blocked even with `*`.

## HTTP or a provider library

Use the returned fetch function for a normal HTTP request, or pass it to a library that accepts custom fetch. For example, `@ai-sdk/openai` accepts it when constructing the provider:

```ts
const provider = createOpenAI({
  apiKey: String(plugin.settings.apiKey),
  baseURL: String(plugin.settings.endpoint),
  fetch: createPluginFetch(plugin.api),
});
const model = provider(String(plugin.settings.model));
```

Here `plugin` is the result of `usePlugin()`, `createOpenAI` comes from `@ai-sdk/openai`, and `createPluginFetch` comes from `@sobes-tech/plugin-sdk`. Bundle the provider library with the plugin. Its model ID is the value from your settings, not a Sobes model identifier.

The provider defines request parameters, output format and token limits. The [network limits](network.md#limits-and-browser-differences) apply to the transport. An `AbortSignal` stops the connection; it cannot reverse a charge for work already accepted by the provider. Retrying a failed request can create a second generation, so retries belong to the plugin and should be explicit.

## Complete example

[Code Explainer](../../examples/code-explainer/README.md) sends a chat-completions request using its own settings, parses SSE incrementally, renders Markdown and cancels the request when its page closes. It keeps the partial answer when stopped. It is an SDK example and is not listed in the marketplace.

Its [request controller](../../examples/code-explainer/generation.ts) has no server operation ID or resume API. A closed connection cannot be resumed unless the chosen provider exposes that capability.
