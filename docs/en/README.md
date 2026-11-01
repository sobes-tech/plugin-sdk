# SDK documentation

[Русский](../ru/README.md) · [Repository](../../README.md)

The SDK defines TypeScript plugins for the Sobes desktop app. A package contains its manifest and bundled code. The host provides APIs, executes handlers and mounts views.

| Section | Contents |
| --- | --- |
| [Installation and build](getting-started.md) | Dependencies, TypeScript configuration, minimal React plugin, installation |
| [Manifest and permissions](manifest-and-permissions.md) | `PluginManifest`, commands, views, permissions and settings |
| [Core host API](api.md) | Storage, meetings, screenshots, navigation and overlay methods |
| [HTTP and fetch](network.md) | Streaming requests, cancellation, AI SDK adapters and domain permissions |
| [Model requests](model-requests.md) | Own provider URL, API key, model and streaming HTTP |
| [Platform API](platform/README.md) | Notes and tracker CRUD, resource grants and event streams |
| [React API](react-ui.md) | Registration, environment, hooks, components and Markdown |
| [UI slots](ui-slots.md) | 21 placements, context fields and view lifetime |
| [Execution and builder](runtime-and-build.md) | Workers, event handlers, `buildPlugin`, limits and isolation |
| [Publishing](publishing.md) | Package sources, SHA-256, catalog schema and updates |
| [Troubleshooting](troubleshooting.md) | Error codes and rejection conditions |
| [LLM skill](../../skills/sobes-plugin-sdk/SKILL.md) | Instructions and working API patterns for coding assistants |

The current contract uses `apiVersion: 1` and `protocolVersion: 1`. SDK and plugin package versions are independent of the API version.

[Platform methods](platform/README.md) use resource and field grants in addition to the core permission system. Start there when your plugin needs account data or live updates. For model output, call a provider through [HTTP and fetch](model-requests.md) using your plugin's own settings.

Declarations: [types](../../src/index.ts), [permissions](../../src/permissions.json), [React](../../src/react.tsx), [platform API](../../src/platform/types.ts).
