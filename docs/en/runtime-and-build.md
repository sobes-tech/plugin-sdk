# Runtime and builder

[Documentation](README.md) | [Русский](../ru/runtime-and-build.md)

The host is the Sobes desktop app. It validates packages and permissions, executes handlers and exposes APIs. A package may contain a worker, React views, or both.

## Execution models

| Property | Worker | React |
| --- | --- | --- |
| Registration | `definePlugin(definition)` | `renderPlugin(views)` |
| Build entry point | `entrypoint` | `uiEntrypoint` |
| Environment | Separate QuickJS process per invocation | Sandboxed iframe |
| DOM | No | Yes |
| JavaScript state | Reset after each invocation | Retained until iframe unmount |
| UI | Returned `PluginView` / `PluginBlock` | React components |
| Overlay | Unsupported | Supported |
| Additional methods | `meeting.getSelected`, `files.exportText` | None |

Worker globals do not persist across invocations. Persistent data uses `storage` or `files`. React state ends when its iframe is destroyed; hiding an opened panel may retain its component.

## Worker registration

Signature: `definePlugin(definition: PluginDefinition): void`.

`PluginDefinition` accepts optional `commands` and `views` maps of type `Record<string, PluginHandler>`, and `events` of type `Partial<Record<PluginEvent, PluginHandler>>`.

`PluginHandler` receives `PluginContext` and returns `PluginView | PluginBlock | void` or a `Promise` of that result. Command and view handler IDs must match their manifest declarations.

```ts
import { definePlugin } from "@sobes-tech/plugin-sdk";

definePlugin({
  commands: {
    status: ctx => ({
      title: "Status",
      blocks: [{ type: "text", text: ctx.locale }],
    }),
  },
});
```

Outside the worker host, `definePlugin` throws `Plugin bundles must run inside Sobes`. See [serialized UI](ui-slots.md#serialized-ui) for result shapes.

### Invocation context

| Field | Type | Value |
| --- | --- | --- |
| `locale` | `"en" \| "ru"` | Invocation language |
| `settings` | `Readonly<Record<string, string \| boolean>>` | Saved manifest settings |
| `input` | `JsonValue` | Command, action or event parameters |
| `state` | `JsonObject` | Serialized view state supplied to the invocation |
| `context` | `JsonObject` | Placement or invocation context |

Context methods are documented in the [host API](api.md). Returned `PluginView.state` is passed to subsequent serialized-view actions; it is not a retained process heap.

## Builder

Signature: `buildPlugin(options): Promise<void>`, exported by `@sobes-tech/plugin-sdk/build`. Runs in Bun.

| Field | Value |
| --- | --- |
| `manifest` | A `PluginManifest` object |
| `entrypoint` | Worker source path; optional when a React entry point is present |
| `uiEntrypoint` | React source path; optional when a worker entry point is present |
| `outfile` | Destination JSON path |

At least one entry point is required. Supplying both includes worker and React code in one package.

```ts
import { buildPlugin } from "@sobes-tech/plugin-sdk/build";
import type { PluginManifest } from "@sobes-tech/plugin-sdk";

export async function build(manifest: PluginManifest) {
  await buildPlugin({
    manifest,
    entrypoint: "./src/worker.ts",
    uiEntrypoint: "./src/ui.tsx",
    outfile: "./plugin.json",
  });
}
```

The result is a `PluginPackage`: `{ manifest, source, ui? }`. `source` contains worker JavaScript, or `"void 0"` when no worker is supplied. `ui` has the shape `{ javascript: string; css?: string }`.

The builder emits a minified browser-targeted IIFE without source maps or split chunks. Dependencies are bundled. Runtime imports, Node-only libraries and external code loading are unsupported in the sandbox. Assets must use data URLs; the builder inlines KaTeX WOFF2 fonts.

The limit is **32 MiB for the complete UTF-8 JSON**, including manifest, code, CSS, embedded assets and formatting. The builder checks final size before writing. Package installation does not run Bun, a package manager or dependency lifecycle scripts.

### Import paths

| Import | Contents |
| --- | --- |
| `@sobes-tech/plugin-sdk` | Worker registration, core types, `localized`, permissions and platform API client |
| `@sobes-tech/plugin-sdk/build` | `buildPlugin` for the author-time build script |
| `@sobes-tech/plugin-sdk/react` | `renderPlugin`, `usePlugin`, `usePluginApi`, `useWorkspaceHeaderTabs` |
| `@sobes-tech/plugin-sdk/components` | Styled React components and Markdown |
| `@sobes-tech/plugin-sdk/markdown` | `MarkdownRenderer`, `MarkdownRendererExtended` and their props |
| `@sobes-tech/plugin-sdk/markdown-core` | Markdown normalization and highlight parsing |
| `@sobes-tech/plugin-sdk/ui` | Serialized worker UI blocks |
| `@sobes-tech/plugin-sdk/jsx-runtime`, `@sobes-tech/plugin-sdk/jsx-dev-runtime` | JSX for serialized blocks; React files use React's JSX runtime |

## Events

Subscriptions are declared in `manifest.events` and require `events.subscribe`. Keys in `definePlugin({events})` must match event names.

| Event | Trigger | `input` |
| --- | --- | --- |
| `app.ready` | Enabled package becomes ready in the current session | `{}` |
| `app.routeChanged` | Main-window route changes | `{path}` |
| `app.themeChanged` | Main-document theme changes | `{dark: boolean}` |
| `meeting.opened` | Main window opens a meeting preview | `{meetingId}` |
| `meeting.closed` | Main window leaves or switches that preview | `{meetingId}` |
| `meeting.updated` | Meeting detail/preview query updates | `{meetingId}` |
| `notes.changed` | Note-change notification or note-query update | `{}` |
| `tracker.changed` | Tracker-query update | `{}` |

```ts
import { definePlugin } from "@sobes-tech/plugin-sdk";

definePlugin({
  events: {
    "app.routeChanged": async ctx => {
      await ctx.storage.set("activeRoute", ctx.input);
    },
  },
});
```

Each delivery starts a new worker. `app.ready` is tracked by session and package digest; disabling and re-enabling the same digest does not guarantee another delivery. `meeting.opened` and `meeting.closed` follow the main-window route.

Events reflect UI and data-query activity. Duplicate delivery is possible; observation of every intermediate change is not guaranteed. No persistent journal or acknowledgement cursor is provided. For resource subscriptions with snapshots and cursors, use the [platform event stream](platform/events.md).

## Execution limits

| Boundary | Limit |
| --- | --- |
| Worker wall time | 60 seconds per invocation |
| Uninterrupted QuickJS execution | 2 seconds; reset after a completed host RPC |
| QuickJS heap / stack | 96 MiB / 512 KiB |
| Running workers | One per plugin, at most four per session |
| Main-window queue | Up to 32 calls per plugin |
| Worker RPC | Up to 64 calls per invocation; 20 seconds per call within the wall deadline |
| Invocation data | 8 MiB, separate from the package |
| Worker output and API replies | 16 MiB |
| React view leases | Up to 64 per session |
| React RPC | Eight in-flight calls per view; parameters up to 8 MiB and replies up to 16 MiB |
| React call deadline | Usually 20 seconds in the host and 22 seconds in the bridge |
| JSON chooser deadline | 300 seconds in the host and 302 seconds in the bridge |

Worker RPC is synchronous at the process boundary despite the SDK promise interface. A completed RPC resets the QuickJS interrupt window but does not extend the overall 60-second deadline.

A `view lease` is the temporary API token for one React view. Closing a view, changing settings, updating or disabling the plugin, or replacing the session revokes its token and active invocations. Late responses are rejected. Remote writes completed before revocation are not rolled back.

## Isolation

The iframe has an opaque origin. Parent DOM, application credentials and Tauri IPC are inaccessible. CSP blocks direct network access, external scripts, fonts and images, nested frames and form submission. Browser camera, microphone, geolocation, clipboard and display-capture permissions are denied.

Workers have no DOM, Node.js, Bun, direct filesystem access or Tauri API. Data, network and files use [permission-checked host methods](manifest-and-permissions.md).

### Failure containment

Each view has an error boundary. An uncaught script error, unhandled promise rejection or missing ready signal after 15 seconds closes that iframe and lease. Retry creates a new instance.

Installed packages, settings and storage are checked individually. A failed installation returns `enabled: false` and `PluginInstallation.error`. Its record and files remain intact. An unreadable shared profile prevents session startup.

A worker exception, timeout or process exit fails its invocation. A save dialog opened after worker completion does not occupy a native worker slot. Only an admission refusal, `plugin_busy`, is retried automatically, for up to 65 seconds. Operations with an uncertain outcome are not automatically retried.

Resource-change events and automatic serialized-view refreshes track the causal plugin chain. Plugins already in that chain are excluded from repeated processing. Resources are tracked separately.

An iframe does not guarantee a separate operating-system process. Shared browser-engine stalls and crashes are outside this boundary. QuickJS limits do not apply to React.
