# Публикация

[Документация](README.md) | [English](../en/publishing.md)

Пакет размещается в GitHub-репозитории автора или в GitHub Release. Метаданные размещаются отдельно в [plugin-marketplace](https://github.com/sobes-tech/plugin-marketplace). Каталог не собирает исходники: он содержит ссылку на готовый JSON и его SHA-256.

## Источник пакета

`source` допускает две формы:

| Тип | Поля |
| --- | --- |
| `github` | `{ type: "github", repository, revision, path }` |
| `release` | `{ type: "release", repository, tag, asset }` |

`repository` имеет формат `owner/repository`, до 201 символа. `revision` — полный commit SHA из 40 строчных шестнадцатеричных символов. `path` — путь относительно репозитория, до 300 символов, без пустых сегментов, `.` и `..`. В каждом сегменте разрешены латинские буквы, цифры, `_`, `-` и `.`.

Для `release` задаются tag до 128 символов и имя asset до 200 символов. Имя asset допускает латинские буквы, цифры, `_`, `-` и `.`. Изменение содержимого по этому адресу без обновления SHA-256 приводит к ошибке проверки.

## Контрольная сумма

SHA-256 вычисляется по исходным байтам итогового JSON. Изменение кода, форматирования или последнего перевода строки меняет хеш. `manifest` в каталоге должен совпадать с манифестом внутри пакета.

```sh
bun - ./plugin.json <<'TS'
import { createHash } from "node:crypto";

const bytes = await Bun.file(Bun.argv[2]).bytes();
console.log(JSON.stringify({
  manifest: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).manifest,
  sha256: createHash("sha256").update(bytes).digest("hex"),
}, null, 2));
TS
```

## Запись каталога

Файл: `entries/<plugin-id>.json`.

| Поле | Обязательно | Требование |
| --- | --- | --- |
| `id` | Да | ID манифеста, до 100 символов |
| `publisher` | Да | Непустая строка, до 200 символов |
| `category` | Да | Категория из `marketplace.base.json`, до 100 символов |
| `keywords` | Да | Массив строк, до 20 элементов |
| `updatedAt` | Да | Непустая строка даты, до 30 символов |
| `manifest` | Да | Полный манифест пакета; `apiVersion: 1`, семантическая `version` |
| `source` | Да | Источник одной из форм выше |
| `sha256` | Да | 64 строчных шестнадцатеричных символа |
| `changelog` | Да | `{ en: string, ru: string }`; непустые строки до 1 000 символов |
| `overview` | Нет | Markdown `{ en: string, ru: string }`; по 20 000 UTF-8 байт, без HTML |
| `repository` | Нет | HTTPS URL репозитория на `github.com`, до 2 048 символов |
| `screenshots` | Нет | До 10 объектов `{ url, caption? }`; `caption` содержит непустые `en` и `ru` до 500 символов |

Для скриншотов разрешены HTTPS URL на `github.com`, `raw.githubusercontent.com` и `user-images.githubusercontent.com`. URL с учётными данными или явным портом отклоняются.

Точная схема: [marketplace.schema.json](https://github.com/sobes-tech/plugin-marketplace/blob/main/schema/marketplace.schema.json). Проверки дополнительных ограничений: [validate.ts](https://github.com/sobes-tech/plugin-marketplace/blob/main/scripts/validate.ts).

## Сборка каталога

Команды выполняются в репозитории маркетплейса:

```sh
bun install --frozen-lockfile
bun run build
bun run check
bun run test
bun run check:remote
```

`build` формирует `marketplace.json` из `entries/` и `marketplace.base.json`. `check` проверяет соответствие сгенерированного файла исходным данным. `check:remote` скачивает пакеты и проверяет SHA-256 и манифест. Источники должны быть доступны до запуска проверки.

В pull request включаются запись `entries/<plugin-id>.json` и обновлённый `marketplace.json`.

## Обновления

ID плагина сохраняется. Новая версия задаётся в `manifest.version`. Для доступного обновления она должна быть больше установленной по SemVer; изменение только build metadata обновлением не считается.

Обновляются пакет, `source`, `sha256`, `manifest`, `updatedAt` и `changelog`. Рефреш каталога загружает метаданные, но не устанавливает пакет. Установка и изменение разрешений требуют подтверждения пользователя.
