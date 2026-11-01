# Sobes Plugin SDK

[Русский](README.ru.md) · [Documentation](docs/en/README.md)

TypeScript SDK for Sobes desktop plugins. Provides React views, commands, application events and permission-checked APIs. Plugins install as one JSON file containing the manifest, JavaScript and CSS.

Reference: [setup](docs/en/getting-started.md), [manifest](docs/en/manifest-and-permissions.md), [API](docs/en/api.md), [React](docs/en/react-ui.md), [slots](docs/en/ui-slots.md), [builder](docs/en/runtime-and-build.md), [publishing](docs/en/publishing.md).

For coding assistants: [Sobes Plugin SDK skill](skills/sobes-plugin-sdk/SKILL.md). Copy the whole `skills/sobes-plugin-sdk` folder into your assistant's skill directory. It includes build instructions, API recipes and the host's permission and runtime boundaries.

The desktop host implements API 1: the core API, 21 UI slots, application events, [revision-checked CRUD and live event streams](docs/en/platform/README.md). Plugins check available methods, features and granted access through `api.capabilities`.

## SDK checks

```sh
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun run check:permissions
bun run test
bun run build:examples
bun run build:plugins
bun run test:examples
bun run test:plugins
```

`bun run format` applies Prettier formatting and ESLint spacing fixes. CI checks both without modifying files.

[Code Explainer](examples/code-explainer/README.md) shows direct model requests with plugin-owned URL, API key and model settings, streaming and cancellation.

Example source is in `examples/`; plugin source is in `plugins/`. Build output is written to `examples/bundles/` and `plugins/bundles/`. Installation: **Plugins → Installed → Install from file**.

Public types: [src/index.ts](src/index.ts). Permission registry: [src/permissions.json](src/permissions.json). Platform API: [src/platform](src/platform). Catalog metadata is published separately in [plugin-marketplace](https://github.com/sobes-tech/plugin-marketplace).
