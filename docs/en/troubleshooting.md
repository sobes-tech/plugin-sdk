# Troubleshooting

[Documentation](README.md) | [Русский](../ru/troubleshooting.md)

## Package installation

| Error | Condition |
| --- | --- |
| `plugin_incompatible_api` | `apiVersion` is not the number `1` |
| `plugin_unsupported_slot` | Slot is absent from the [supported list](ui-slots.md) |
| `plugin_unsupported_feature` / `plugin_unsupported_grant` | Unsupported `requiredFeatures` or `grants` |
| Invalid manifest | Invalid IDs or localized values, duplicate declaration, or incompatible renderer/slot/permissions |
| Size limit | Complete UTF-8 JSON exceeds 32 MiB |
| Manifest or SHA-256 mismatch | Catalog metadata differs from the downloaded package |

Type checking does not replace host package validation. Catalog installation checks the exact package bytes and manifest.

## View registration

A view is eligible for mounting when:

- the installation is enabled and has no `PluginInstallation.error`;
- `views[].id` matches a key in `renderPlugin` or `definePlugin.views`;
- the slot is supported and has its required permission;
- `renderer: "react"` has a UI bundle.

`app.page` with `showInSidebar: false` has no navigation entry; it opens through `app.openPage`. Overlay control visibility also depends on Meeting Panel settings.

React views use the React JSX runtime. `@sobes-tech/plugin-sdk/ui` and the SDK JSX runtime produce serialized worker UI blocks.

## API failures

`api.capabilities` reports method support. Access depends on the manifest, approved permissions and invocation context. Editing `manifest.ts` does not change an installed package; rebuild and reinstall it.

| Error or result | Handling |
| --- | --- |
| `plugin_api_failed` | Core API adapter failure; inspect parameters, permissions and resource availability |
| `plugin_api_timeout` | No result before the deadline; a server-side write may have completed |
| `PluginApiError` | Structured [platform API](platform/README.md) error |
| `baseContentHash` conflict | Read the current note and reconcile the update with its content |

An uncertain write result does not imply cancellation. Automatically repeating creation can duplicate an object. The core API has no general idempotency key; [resource CRUD](platform/data.md) defines a separate idempotency contract.

## View state and failures

An uncaught exception or unhandled rejection stops the affected iframe. Retry creates a new instance and API lease. Expected asynchronous failures require a `catch` handler.

`useState` is not persistent storage. Data survives view instances only after it is written through `storage` or `files`.

Damaged package, settings or installation storage yield `enabled: false` and `PluginInstallation.error`. Invalid settings can be repaired by saving valid settings. Reinstalling the same digest does not replace a damaged immutable package cache.

## File dialogs

`files.openJson` and `files.saveJson` require `files.userSelected`, a main-window React view and active user interaction. Awaiting unrelated asynchronous work first can lose browser user activation.

Workers and overlays cannot open these dialogs. One JSON dialog may be active at a time; another call can return `plugin_busy`. Cancellation returns `null` for open and `false` for save.

## Network and assets

CSP blocks direct iframe `fetch`. `network.request` requires its permission and a matching hostname or wildcard in [`networkDomains`](network.md#declare-access). It supports HTTPS GET/POST and UTF-8 text responses. Sobes cookies and account tokens are not attached. An HTTP error may arrive as a resolved response with a status code.

External scripts, fonts and images cannot load directly. Assets are bundled as data URLs.

## Catalog

Refresh retrieves metadata; it does not install a package. Source and entry failures are reported through `warningDetails`. Other available entries remain visible.

A reproduction requires the plugin ID and version, package SHA-256, app version, OS and operation. Layout reports also require the slot and container dimensions.
