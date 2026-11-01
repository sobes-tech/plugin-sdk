# HTTP and fetch

[Documentation](README.md) · [Русский](../ru/network.md)

Use `createPluginFetch` when a library accepts a custom `fetch`, or when you need a binary response or a stream. It sends HTTP requests through the native host and returns standard browser `Response` objects. The host checks the plugin's permissions before opening a connection.

For small text requests from a worker, [`network.request`](api.md#network-requests) is simpler. That method buffers the whole response and has a 15-second timeout.

## Declare access

Add `"network.request"` to `permissions` and declare allowed destinations in `networkDomains`:

```ts
permissions: ["ui.render", "network.request"],
networkDomains: ["api.openai.com"],
```

An entry can be an exact hostname or a wildcard:

| Entry | Allows |
| --- | --- |
| `api.example.com` | That hostname only |
| `*.example.com` | `api.example.com`, `v2.api.example.com` and other subdomains; excludes `example.com` |
| `*` | Any public HTTPS destination |

The user approves the declared access when installing or updating the package. Every redirect must also match an entry. Wildcards preserve HTTPS-only transport, port 443, DNS validation and the block on private, loopback and other non-public addresses.

Hostnames and suffixes after `*.` use lowercase ASCII or punycode, with at least two nonempty labels of at most 63 characters each. Labels cannot start or end with a hyphen. The complete entry is limited to 253 bytes; schemes, paths, ports and partial globs such as `api.*.com` are rejected. `*.com` is not accepted.

## Create the adapter

```ts
import { createPluginFetch } from "@sobes-tech/plugin-sdk";
import { usePlugin } from "@sobes-tech/plugin-sdk/react";

function useProviderFetch() {
  const plugin = usePlugin();

  return createPluginFetch(plugin.api);
}
```

Signature: `createPluginFetch(call): PluginFetch`. `call` is the plugin's `api` function. `PluginFetch` accepts `(input: RequestInfo | URL, init?: RequestInit)` and returns `Promise<Response>`.

Pass the returned function to the library's custom-fetch option. For example, with `@ai-sdk/openai`:

```ts
const provider = createOpenAI({
  apiKey: String(plugin.settings.apiKey),
  baseURL: String(plugin.settings.endpoint),
  fetch: createPluginFetch(plugin.api),
});
```

`createOpenAI` comes from `@ai-sdk/openai`. Supply the URL, API key and model in your own plugin settings. Bundle the provider library with the plugin; runtime imports from a CDN are blocked. See [model requests](model-requests.md) for a complete example. Requests go directly from the desktop to your chosen provider. Your plugin handles errors, retries, streaming and saved conversation state.

## Read and cancel

The response exposes `status`, `ok`, `headers`, `url`, `redirected`, `text()`, `json()`, `arrayBuffer()` and a `ReadableStream<Uint8Array>` in `body`. Fetch resolves after the response headers arrive. A status such as 401 or 429 is still a response; check `response.ok`.

Pass an `AbortSignal` through `init.signal` to cancel opening the connection or reading the body. Calling `response.body.cancel()` also closes the native request. Consume or cancel every body; an unread body keeps its request slot until the deadline. Errors after headers have arrived reject the body reader.

Disabling or removing the plugin, revoking permissions, replacing its package, closing its view or signing out stops its active requests. An aborted request may already have reached the provider and incurred a charge; retry only when the operation is safe to repeat.

## Limits and browser differences

| Property | Behavior |
| --- | --- |
| Runtime | React views with browser `Request`, `Response` and `ReadableStream`; QuickJS workers do not provide these globals |
| Methods | GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS |
| Upload | Up to 2 MiB of body bytes, buffered before dispatch; no streaming upload |
| Download | Up to 16 MiB of body bytes; delivered in chunks of at most 128 KiB |
| Headers | Up to 32 request headers, 64 KiB total; each value at most 8 KiB |
| Concurrency | 8 open requests per installation, 64 across the host |
| Deadline | 10 minutes including connection and body transfer; 10 seconds to connect |
| Redirects | `follow` by default, at most three; `manual` and `error` are supported |
| Address | HTTPS on port 443, public IPs only; no URL username or password |

The native client pins validated DNS addresses and checks each redirect. It strips `Authorization` on a redirect to another origin. POST becomes GET on 301/302; 303 becomes GET except for HEAD. Browser CORS does not apply to the native connection.

There is no cookie jar or inherited account authorization. `credentials`, `cache`, `mode`, `referrer`, `integrity` and other browser-specific `RequestInit` options do not configure the native client. Set your own `Authorization` header if needed. `Cookie`, `Host`, `Proxy-Authorization`, `Connection`, `Transfer-Encoding` and `Content-Length` are rejected; `Set-Cookie` is omitted from responses. System and app proxies are not used. Direct `window.fetch`, WebSocket and EventSource connections remain blocked in the iframe.

The adapter uses three internal RPCs under the same `network.request` permission: `network.open`, `network.read` and `network.close`. Use the adapter rather than calling them directly; it handles request IDs, binary encoding, cancellation and cleanup.
