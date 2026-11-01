# Sobes Plugin SDK

[English](README.md) · [Документация](docs/ru/README.md)

TypeScript SDK для плагинов десктопного приложения Sobes. Поддерживает React-интерфейсы, команды, события приложения и API с проверкой разрешений. Формат установки — один JSON-файл с манифестом, JavaScript и CSS.

Документация: [подключение](docs/ru/getting-started.md), [манифест](docs/ru/manifest-and-permissions.md), [API](docs/ru/api.md), [React](docs/ru/react-ui.md), [слоты](docs/ru/ui-slots.md), [сборщик](docs/ru/runtime-and-build.md), [публикация](docs/ru/publishing.md).

Для LLM-ассистентов: [skill для Sobes Plugin SDK](skills/sobes-plugin-sdk/SKILL.md). Скопируйте папку `skills/sobes-plugin-sdk` целиком в каталог skills вашего ассистента. Внутри — сборка плагина, примеры API, разрешения и ограничения хоста.

Десктопный хост реализует API 1: базовые методы, 21 UI-слот, события приложения, [CRUD с проверкой ревизий и живые потоки событий](docs/ru/platform/README.md). Доступные методы, возможности и выданные разрешения плагин проверяет через `api.capabilities`.

## Проверки SDK

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

`bun run format` применяет форматирование Prettier и исправляет отступы между блоками через ESLint. В CI обе проверки работают без изменения файлов.

[Разбор кода](examples/code-explainer/README.md) показывает прямые запросы к модели: свои URL, API-ключ и ID модели, потоковый ответ и отмену.

Исходники примеров находятся в `examples/`, исходники плагинов — в `plugins/`. Сборки записываются в `examples/bundles/` и `plugins/bundles/`. Установка: **Плагины → Установленные → Установить из файла**.

Публичные типы: [src/index.ts](src/index.ts). Реестр прав: [src/permissions.json](src/permissions.json). API приложения: [src/platform](src/platform). Каталог публикуется отдельно в [plugin-marketplace](https://github.com/sobes-tech/plugin-marketplace).
