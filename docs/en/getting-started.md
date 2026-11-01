# Installation and build

[Documentation](README.md) | [Русский](../ru/getting-started.md)

Requirements: Bun, TypeScript and a Sobes desktop host implementing API 1. Install the SDK from GitHub. React and its dependencies are bundled into the plugin package.

## Dependencies

Run in the project directory containing `package.json`:

```sh
bun add git+https://github.com/sobes-tech/plugin-sdk.git react@19.1.0 react-dom@19.1.0
bun add -d typescript@~5.8.3 @types/bun @types/react@^19 @types/react-dom@^19
```

Commit `bun.lock` and use `bun install --frozen-lockfile` for reproducible installation. The SDK version does not determine which methods the host implements.

## TypeScript configuration

`tsconfig.json` for a React plugin:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["src", "manifest.ts", "build.ts"]
}
```

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "bun build.ts"
  }
}
```

## Minimal React plugin

`manifest.ts`:

```ts
import type { PluginManifest } from "@sobes-tech/plugin-sdk";

export const manifest = {
  id: "example.plugin",
  version: "1.0.0",
  apiVersion: 1,
  name: { en: "Example plugin", ru: "Пример плагина" },
  description: { en: "Plugin UI", ru: "Интерфейс плагина" },
  permissions: ["ui.render"],
  commands: [],
  views: [{
    id: "main",
    title: { en: "Plugin", ru: "Плагин" },
    slot: "app.page",
    renderer: "react",
  }],
} satisfies PluginManifest;
```

`views[].id` must match the registration key in `renderPlugin`. `renderer: "react"` requires a UI bundle. `ui.render` permits a main-window view; data access requires separate permissions.

`src/ui.tsx`:

```tsx
import { renderPlugin, usePlugin } from "@sobes-tech/plugin-sdk/react";
import { Page, Text } from "@sobes-tech/plugin-sdk/components";

function PluginPage() {
  const { locale } = usePlugin();
  return <Page>
    <Text>{locale === "ru" ? "Плагин загружен" : "Plugin loaded"}</Text>
  </Page>;
}

renderPlugin({ main: PluginPage });
```

Call `renderPlugin` once from the UI entry point. `usePlugin` is available inside the registered component and returns the host API and view environment.

`build.ts`:

```ts
import { buildPlugin } from "@sobes-tech/plugin-sdk/build";
import { manifest } from "./manifest";

await buildPlugin({
  manifest,
  uiEntrypoint: "./src/ui.tsx",
  outfile: "./plugin.json",
});
```

## Build and install

```sh
bun run typecheck
bun run build
```

Output: `plugin.json` containing the manifest, JavaScript and CSS. The maximum file size is 32 MiB.

In Sobes, select **Plugins → Installed → Install from file** and approve the requested permissions. The `app.page` view appears in the sidebar at `/plugins/example.plugin/main`.

Source changes require rebuilding and reinstalling the package. Increment `manifest.version` when publishing an update.

References: [manifest](manifest-and-permissions.md), [React API](react-ui.md), [slots](ui-slots.md), [builder and worker](runtime-and-build.md), [host methods](api.md).
