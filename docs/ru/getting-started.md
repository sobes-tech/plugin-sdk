# Подключение и сборка

[Документация](README.md) | [English](../en/getting-started.md)

Требования: Bun, TypeScript и десктопное приложение Sobes с API 1. SDK устанавливается из GitHub; React и его зависимости включаются в пакет плагина при сборке.

## Зависимости

Команды выполняются в каталоге проекта с `package.json`:

```sh
bun add git+https://github.com/sobes-tech/plugin-sdk.git react@19.1.0 react-dom@19.1.0
bun add -d typescript@~5.8.3 @types/bun @types/react@^19 @types/react-dom@^19
```

Сохраните `bun.lock` в репозитории. Для воспроизводимой установки используйте `bun install --frozen-lockfile`. Версия SDK не определяет поддержку методов хостом.

## Конфигурация TypeScript

`tsconfig.json` для React-плагина:

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

В `package.json` добавьте скрипты:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "bun build.ts"
  }
}
```

## Минимальный React-плагин

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

`views[].id` должен совпадать с ключом регистрации в `renderPlugin`. Поле `renderer: "react"` требует UI-бандл. `ui.render` разрешает размещение в основном окне; доступ к данным запрашивается отдельно.

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

`renderPlugin` вызывается один раз из точки входа. `usePlugin` доступен внутри зарегистрированного компонента и предоставляет API хоста и окружение интерфейса.

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

## Сборка и установка

```sh
bun run typecheck
bun run build
```

Результат: `plugin.json` с манифестом, JavaScript и CSS. Максимальный размер файла — 32 MiB.

Установка в Sobes: **Плагины → Установленные → Установить из файла**. После подтверждения прав страница `app.page` доступна из боковой навигации. Её маршрут: `/plugins/example.plugin/main`.

Изменение исходников требует повторной сборки и установки. Для обновления опубликованного пакета увеличивается `manifest.version`.

См. [манифест](manifest-and-permissions.md), [React API](react-ui.md), [слоты](ui-slots.md), [сборщик и worker](runtime-and-build.md), [методы хоста](api.md).
