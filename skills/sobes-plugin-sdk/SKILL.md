---
name: sobes-plugin-sdk
description: Build, modify, or review Sobes desktop plugins with the Sobes Plugin SDK. Use for plugin manifests, React pages and meeting-overlay panels, worker commands, resource permissions, live meeting events, plugin storage, model HTTP requests, and marketplace packages.
---

# Sobes Plugin SDK

Build the plugin the user asked for using the public SDK. The deliverable is a self-contained JSON package, its source, and evidence of the checks actually run. This skill is for Sobes plugins, not BB, browser, or Tauri plugins.

## Start with the installed contract

Inspect the project's package manifest, lockfile, existing plugin and local instructions before editing. Use Bun. If the SDK checkout is available, its `src/index.ts`, `src/platform/`, `src/components.tsx` and examples are the source of truth. Otherwise read the relevant public references below. Verify method names and signatures before using them; do not infer APIs from the surrounding Sobes application.

The current contract is `apiVersion: 1`. A TypeScript export does not grant access: the host checks capabilities, manifest permissions and resource grants. Do not change the host, backend or marketplace merely to make a plugin example compile.

Read only what the task needs:

| Task | Start here | Authoritative reference |
| --- | --- | --- |
| New project, manifest, build | [Starter](references/starter.md) | [Setup](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/getting-started.md), [manifest](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/manifest-and-permissions.md) |
| React, layout, overlay placement | UI rules below | [React](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/react-ui.md), [slots](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/ui-slots.md) |
| Messages, transcript, notes, tracker | [Data and events](references/data-and-events.md) | [Platform API](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/platform/README.md) |
| Model requests or other HTTP | [Network and files](references/network-and-files.md) | [HTTP](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/network.md), [models](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/model-requests.md) |
| Local state or JSON import/export | [Network and files](references/network-and-files.md) | [Core API](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/api.md) |
| Worker commands and lifecycle events | Runtime rules below | [Runtime](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/runtime-and-build.md) |
| Publication | Delivery rules below | [Publishing](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/publishing.md) |

Russian documentation starts at [docs/ru/README.md](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/ru/README.md). This skill folder can be copied on its own; its relative references stay inside the folder.

## Choose the runtime and surface

- For an interactive interface, use React. Import `renderPlugin`, `usePlugin`, `usePluginApi` and `useWorkspaceHeaderTabs` from `@sobes-tech/plugin-sdk/react`; import React components from `/components`.
- Register the component under the exact `views[].id`. Declare `renderer: "react"` and pass `uiEntrypoint` to `buildPlugin`.
- Use `app.page` and `ui.render` for a standalone main-window page. For a docked meeting panel like notes or System Design, use `overlay.workspace` and `overlay.render`. Compact controls use `overlay.toolbar`, `overlay.panel` or `overlay.footer`: omit `display` (or use `"popover"`) for a small popup; use `display: "inline"` for a button rendered directly in the native row.
- Message controls use `overlay.message.header` or `overlay.message.footer`. Check `context.meetingId` and `context.messageId` before using them. Context identifies a resource; it does not authorize reading it.
- Only those five compact overlay slots accept `display: "popover" | "inline"`. `overlay.workspace` and all non-overlay slots reject `display`. `inlineWidth` requires `display: "inline"` and is an integer from 24 to 240 CSS pixels; the default width is 36 px in the toolbar/composer or 24 px by a message.
- Never invent slot names, including `app.header`. Select other slots from the actual `PluginSlot` type or slot reference.
- For a bounded command or lifecycle handler, use `definePlugin` from the SDK root with a worker `entrypoint`. Worker `/ui` components create serialized blocks; they are not React components. A worker has no browser DOM or Node filesystem. It runs for at most 60 seconds with a 64-call host API budget, not as a permanent background daemon.

## Respect the plugin boundary

Plugins cannot access the parent's DOM, Tauri commands, application stores, auth cookies, Centrifugo credentials, Node APIs or arbitrary disk paths. Do not import private Sobes modules or call its backend directly to bypass a missing SDK method.

Keep the three APIs distinct:

- `const plugin = usePlugin()` exposes core helpers such as `plugin.files`, `plugin.storage`, `plugin.notes` and `plugin.api(method, params)`.
- `const api = usePluginApi()` exposes resource grants, revision-aware `api.notes` / `api.tracker`, and `api.events`. Their wire names use `data.*` and `events.*`.
- `createPluginFetch(plugin.api)` provides fetch-compatible HTTP through the native host. Direct `window.fetch`, WebSocket and EventSource are blocked inside the iframe.

Request only the permissions and fields the feature uses. Keep plugin-owned state separate from account notes or tracker data. Do not request clipboard access, whole-account grants or all network domains by default. When the user needs an arbitrary configurable provider, `networkDomains: ["*"]` is supported; explain that access in the plugin's UI and permission request.

There is no host-managed AI provider selector or generation API. Do not generate `ai.providers.*`, `ai.generations.*`, `chat.byokTurns.*` or a server queue for plugin inference. `models.list` is a read-only catalog, not generation access. A model integration uses plugin settings for URL, API key and model, then calls the provider through `createPluginFetch`.

## Build a UI that fits the host

Use SDK components and semantic CSS variables. Keep the root transparent; avoid a second opaque card covering the meeting panel. For a full-height overlay, use a flex column with `min-height: 0` and scroll only the content area. Use compact spacing in inline panels.

An inline overlay control receives `layout: "control"`, with fixed height 32 px in the toolbar/composer or 24 px by a message. Fit the transparent root and its SDK `Button` to 100% width/height with zero button padding. Use an icon with `aria-label` and `title`, `aria-pressed` for a toggle, and React `onClick` for an action. Keep state in the plugin and call only authorized APIs; do not use the worker action protocol or invent `overlay.control` behavior for a local toggle. Control iframes clip portals; choose a popover for menus. Workspace `layout: "inline"` is distinct from compact `layout: "control"`.

Use `useWorkspaceHeaderTabs` for panel tabs, with an inline `/components` `Tabs` fallback when it returns `false`. Use the SDK React `Select` rather than a native `<select>`; native menus do not work consistently with desktop capture protection. Treat `/ui` serialized controls as a different API.

Provide English and Russian manifest text. Use `usePlugin().locale` for UI labels; honor the host theme. Cover loading, empty, error and disabled states. Catch rejected event loops and async handlers. Cancel network requests and subscriptions on unmount or meeting change, and reject stale results before updating state. Hiding a visited panel can preserve its iframe, so hidden does not necessarily mean unmounted.

## Build and verify

Use `buildPlugin` from `@sobes-tech/plugin-sdk/build`. Bundle browser-compatible dependencies, CSS, fonts and other assets into the package. Runtime imports, external fonts and emitted asset files do not work in the sandbox. The complete serialized UTF-8 JSON must fit in 32 MiB.

Run the project's existing typecheck and build scripts with Bun. For a new project, use the scripts in the starter. Check that the output manifest matches the source and that each view/command ID has a registration. Add focused behavior tests when there is parsing, calculation, event ordering, mutation or recovery logic; do not test prose by matching strings.

When working in the SDK repository, use its existing `typecheck`, `lint`, `format:check`, `check:permissions`, `test`, `build:examples`, `build:plugins`, `test:examples` and `test:plugins` scripts as relevant. Rebuild committed bundles when their source changes. Do not run a desktop app or development server unless the user's instructions allow it.

Typecheck and bundling do not prove desktop behavior. Report whether the plugin was installed and exercised in the intended host. If runtime access is unavailable, identify the untested interaction instead of claiming visual or OS-level validation.

## Delivery and publication

Keep source, executable bundle and catalog metadata in their proper repositories. The public SDK and examples live in `sobes-tech/plugin-sdk`; the catalog lives in `sobes-tech/plugin-marketplace`. An ordinary plugin project can use its own repository. Do not put plugin implementation into the Sobes monorepo.

For a requested marketplace update, publish the exact package bytes first, then use their SHA-256, complete manifest and immutable source revision in the catalog. Increment the package version for a distributed update. Keep overview, captions and changelog in both English and Russian. Generate the catalog index and run its local and remote package checks. Publishing, pushing and editing remote catalog data require authorization from the user; this skill does not provide that authorization.

Finish with the source and package paths, requested permissions, checks run and any runtime limitation. Keep secrets and provider responses out of logs and committed fixtures.
