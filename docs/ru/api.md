# Справочник основного API

[Документация](README.md) | [English](../en/api.md)

Основной API доступен через `ctx` в обработчике worker и через `usePlugin()` в React. Все методы в таблицах возвращают promise; столбец «Результат» содержит значение после его завершения. Доступ ограничен текущим авторизованным аккаунтом и разрешениями установленного плагина.

Здесь описаны основные RPC-методы и локальные хелперы worker. Права на ресурсы и события `data.*`, `events.*` описаны в [API приложения](platform/README.md). Псевдонимы типов ниже обозначают форму аргументов и не являются дополнительными экспортами SDK.

## Вызовы API

Типизированные методы, например `notes.get(id)`, используют тот же вызов хоста, что и низкоуровневый API:

```text
api<T extends JsonValue = JsonValue>(method: string, params?: JsonValue): Promise<T>
```

Параметр `T` задаёт тип результата в TypeScript, но не проверяет значение во время выполнения. Проверка доступа одинакова для типизированного и низкоуровневого вызова.

`api("api.capabilities", {})` возвращает `apiVersion`, `protocolVersion`, `methods`, `slots`, `permissions`, `features`, `grants`, `transports`. Хост сообщает API 1 и протокол 1. В `permissions` находятся основные разрешения, в `grants` — фактические права на ресурсы. `transports.events === 1` означает поддержку подписок. Наличие метода в `methods` обозначает поддержку, а не право на вызов.

Типизированный доступ к capabilities: `createPluginApi({ call: (method, params) => ctx.api(method, params) }).capabilities()` в worker или `usePluginApi().capabilities()` в React. См. [API приложения](platform/README.md).

## Общие типы данных

| Тип | Поля |
| --- | --- |
| `JsonValue` | `null`, boolean, число, строка, массив JSON-значений или объект с JSON-значениями. |
| `JsonObject` | Объект с ключами-строками и JSON-значениями. |
| `PageQuery` | `{ cursor?: string; limit?: number; query?: string }`. |
| `Page<T>` | `{ items: T[]; nextCursor: string \| null; total: number }`. |
| `MeetingSummary` | `{ id, title, createdAt, mode, summaryStatus }`, все поля имеют тип string. |
| `PluginMessage` | `{ id?: string; text: string; speaker: string; createdAt: string }`. |
| `NoteRecord` | Обязательные `id`, `name`; необязательные `content`, `contentHash: string \| null`, `folderId: string \| null`, `updatedAt: string \| null`, `tags: string[]`. |
| `Screenshot` | `{ id: string; meetingId: string; createdAt: string }`. |
| `ScreenshotContent` | `Screenshot` с полями `dataUrl: string` и `mimeType: string`. |
| `PluginFileEntry` | `{ path: string; sizeBytes: number }`. |
| `SelectedJsonFile` | `{ name: string; value: JsonValue }`. |

Передавайте ID так, как он пришёл от API: не разбирайте его и не стройте из него URL. Большинство аргументов с ID допускают от 1 до 128 единиц UTF-16, ID скриншота до 256. Для этих ограничений длина соответствует JavaScript `string.length`. Даты возвращаются строками. Поля внутренних моделей, не перечисленные в контракте, могут быть недоступны.

### Постраничная загрузка

Постранично загружаются `meetings.list`, `notes.list` и `tracker.cards`. Первый запрос отправьте без `cursor`, для следующего передайте полученный `nextCursor` и ту же строку поиска. `null` означает конец списка. `limit` по умолчанию равен 30; передавайте целое число от 1 до 100. Если пользователь изменит данные во время обхода, состав следующих страниц может поменяться.

Пример постраничного чтения. Разрешение: `meetings.read`.

```ts
import type { MeetingSummary, PluginContext } from "@sobes-tech/plugin-sdk";

export async function readMeetings(ctx: PluginContext, query = "") {
  const items: MeetingSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.meetings.list({ query, cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}
```

## Встречи и скриншоты

```ts
type CreateMeeting = {
  title?: string;
  mode?: "interview" | "system_design";
};
```

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `meetings.list(query?: PageQuery)` | `meetings.list`, query или `{}` | `Page<MeetingSummary>` | `meetings.read` |
| `meetings.get(id: string)` | `meetings.get`, `{ id }` | `MeetingSummary & { summary: JsonValue }` | `meetings.read` |
| `meetings.messages(id: string)` | `meetings.messages`, `{ id }` | `PluginMessage[]` | `meetings.read` |
| `meetings.create(input: CreateMeeting)` | `meetings.create`, `input` | `{ id: string }` | `meetings.write` |
| `meetings.rename(id: string, title: string)` | `meetings.rename`, `{ id, title }` | `void` | `meetings.write` |
| `screenshots.list(meetingId: string)` | `screenshots.list`, `{ meetingId }` | `Screenshot[]` | `screenshots.read` |
| `screenshots.get(meetingId: string, id: string)` | `screenshots.get`, `{ meetingId, id }` | `ScreenshotContent` | `screenshots.read` |

Поиск встреч идёт по названию без учёта регистра. В списке нет текста сообщений. `meetings.get` добавляет `summary`, но это может быть `null` или другое JSON-значение. Перед выводом как Markdown проверьте, что это строка.

`meetings.messages` возвращает сохранённые сообщения с текстом, автором, датой и ID. Аудио, содержимое изображений, внутренние рассуждения модели и поток новых токенов в этот ответ не входят. Для живой транскрипции этот метод не подходит.

Если не передать название при создании встречи, оно будет пустым. Переданный текст обрезается до 200 единиц UTF-16. Для `mode` допустимы `interview` и `system_design`. Переименование строже: нужна непустая строка до 200 единиц UTF-16.

ID скриншотов относятся к изображениям указанной встречи, а не к постоянным адресам загрузки. `screenshots.get` принимает PNG, JPEG, WebP, GIF и BMP размером до 8 MiB. Отсутствующее изображение, ошибка загрузки или неподдерживаемые данные отклоняют promise.

## Заметки

```ts
type CreateNote = {
  name: string;
  content?: string;
  folderId?: string | null;
};
type NotePatch = {
  name?: string;
  content?: string;
  baseContentHash?: string;
};
```

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `notes.list(query?: PageQuery)` | `notes.list`, query или `{}` | `Page<NoteRecord>` | `notes.read` |
| `notes.get(id: string)` | `notes.get`, `{ id }` | `NoteRecord` | `notes.read` |
| `notes.folders()` | `notes.folders` | `JsonObject[]` | `notes.read` |
| `notes.create(input: CreateNote)` | `notes.create`, `input` | `NoteRecord` | `notes.write` |
| `notes.update(id: string, patch: NotePatch)` | `notes.update`, `{ id, patch }` | `NoteRecord` | `notes.write` |

`notes.list` ищет по имени без учёта регистра и отдаёт карточки без текста и хеша. Для редактирования загрузите `notes.get(id)`. `notes.folders()` возвращает весь список папок с `id`, `name` и `order`, без страниц.

У новой заметки имя обязательно: непустая строка до 200 единиц UTF-16. Пропущенный текст будет пустым, папка по умолчанию `null`. При создании и обновлении текст обрезается до 1 000 000 единиц UTF-16; при обновлении имя обрезается до 200.

`baseContentHash` обязателен при изменении `content`: передайте непустую строку до 128 единиц UTF-16 из последнего чтения заметки. Для переименования хеш не нужен. Эти методы меняют только имя и текст: теги, перенос, удаление заметок и управление папками через них недоступны.

## Трекер и каталог моделей

```ts
type CreateCard = {
  columnId: string;
  company: string;
  position?: string;
  url?: string;
  notes?: string;
};
type CardPatch = {
  company?: string;
  position?: string;
  notes?: string;
};
```

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `tracker.columns()` | `tracker.columns` | `JsonObject[]` | `tracker.read` |
| `tracker.cards(query?: PageQuery)` | `tracker.cards`, query или `{}` | `Page<JsonObject>` | `tracker.read` |
| `tracker.get(id: string)` | `tracker.get`, `{ id }` | `JsonObject` | `tracker.read` |
| `tracker.create(input: CreateCard)` | `tracker.create`, `input` | `JsonObject` | `tracker.write` |
| `tracker.update(id: string, patch: CardPatch)` | `tracker.update`, `{ id, patch }` | `JsonObject` | `tracker.write` |
| `models.list()` | `models.list` | `JsonValue` | `models.read` |

У колонки есть `id`, `title`, `sortOrder` и `kind`. Сейчас приложение запрашивает английские названия колонок. `cards` ищет по компании и должности без учёта регистра по текущей доске. `get` завершится ошибкой, если карточки с таким ID нет.

Для создания нужны непустые `columnId` до 128 и `company` до 200 единиц UTF-16. Пропущенная должность будет пустой; URL и заметки проверяет бэкенд. При обновлении компания и должность обрезаются до 200, заметки до 100 000 единиц UTF-16. Изменить URL существующей карточки, перенести или удалить её и управлять досками текущими методами нельзя.

`models.list()` возвращает каталог настроенных в приложении провайдеров и моделей. В ответе могут быть метаданные пользовательских провайдеров, но не их секретные ключи. Получение каталога не даёт права вызвать модель; генерации через модели Sobes в этом API нет.

## Хранилище

Хранилище ключей и JSON-значений текущего аккаунта и установки плагина. Данные не доступны другим плагинам и не создают заметки Sobes.

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `storage.get<T extends JsonValue = JsonValue>(key: string)` | `storage.get`, `{ key }` | `T \| null` | Неявное `plugin.storage` |
| `storage.set(key: string, value: JsonValue)` | `storage.set`, `{ key, value }` | `void` | Неявное `plugin.storage` |
| `storage.remove(key: string)` | `storage.remove`, `{ key }` | `void` | Неявное `plugin.storage` |

`get` возвращает `null`, если ключа нет. Параметр типа не проверяет загруженный JSON. `set` заменяет одно значение; запись того же значения и удаление отсутствующего ключа ничего не меняют.

Имя ключа занимает от 1 до 128 байт UTF-8. На установку доступны 256 ключей и 256 KiB для всего JSON-объекта. Данные разделены по аккаунтам и установкам. Обновление и откат версии их сохраняют; удаление и новая установка начинают с пустого хранилища. Старые файлы могут остаться на диске.

Данные записываются нативной частью приложения, без шифрования. Ключи провайдеров и токены аккаунтов здесь хранить нельзя. Неверное имя возвращает `plugin_invalid_key`, превышение квоты `plugin_storage_full`. Ошибки диска и повреждённые данные имеют отдельные коды.

## JSON-файлы

### Собственные файлы плагина

Файлы хранятся в нативной папке текущего аккаунта и установки плагина. `path` содержит имя файла внутри этой папки.

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `files.readJson(path: string)` | `files.readJson`, `{ path }` | `JsonValue \| null` | Неявное `plugin.files` |
| `files.writeJson(path: string, value: JsonValue)` | `files.writeJson`, `{ path, value }` | `void` | Неявное `plugin.files` |
| `files.list()` | `files.list`, `{}` | `PluginFileEntry[]` | Неявное `plugin.files` |

Имя файла должно заканчиваться на `.json` в нижнем регистре и занимать до 180 байт UTF-8. Подойдёт `settings.json`. Не подойдут скрытое имя `.hidden.json`, путь `plans/settings.json`, абсолютный путь или пустое имя до расширения. Также запрещены управляющие символы, зарезервированные имена Windows и символы `/\:<>"|?*`. Часть имени до `.json` не может заканчиваться пробелом или точкой.

`readJson` возвращает разобранный JSON или `null`, если файла нет. Сохранённый JSON `null` тоже вернётся как `null`; если важно различать эти случаи, вызовите `list()`. `writeJson` создаёт или атомарно заменяет весь документ. `list` возвращает относительные имена файлов и размеры их содержимого в байтах. Методов для каталогов, удаления файлов и доступа к произвольным путям нет.

| Ограничение | Лимит |
| --- | --- |
| Один сериализованный JSON-документ | 4 MiB |
| Файлы одной установки | 1 024 |
| Общий размер сериализованного содержимого | 32 MiB |

При замене файла учитывается итоговый размер. Превышение квоты и ошибка до замены сохраняют предыдущую записанную версию. Если после атомарного переименования не удалась синхронизация на диск, операция может вернуть ошибку уже после записи нового содержимого. Перед повтором такой записи перечитайте файл.

Две параллельные записи заменяют документ целиком. Если вы сначала читаете файл, а затем меняете часть данных, выполняйте такие операции последовательно. API не объединяет поля, не проверяет ожидаемую версию и не предоставляет транзакции на несколько файлов. Границы аккаунта и установки такие же, как у `storage`; JSON хранится открытым текстом.

### Файлы, выбранные пользователем

Каждый вызов открывает системный диалог и предоставляет доступ только к выбранному файлу.

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `files.openJson()` | `files.openJson`, `{}` | `SelectedJsonFile \| null` | `files.userSelected` |
| `files.saveJson(filename: string, value: JsonValue)` | `files.saveJson`, `{ filename, value }` | `boolean` | `files.userSelected` |

Открыть диалог можно только из React-интерфейса главного окна, непосредственно при действии пользователя и до других `await`. Из обработчика команды, таймера или панели оверлея это не сработает. Эффект монтирования и программный клик не создают пользовательской активации. После настоящего нажатия браузер может сохранять её недолго; постоянным разрешением на диалоги она не является.

`openJson()` возвращает имя без пути и разобранное содержимое, при отмене `null`. `saveJson(name, value)` предлагает имя в диалоге: `true` означает завершённую запись, `false` отмену. Пользователь может выбрать существующий файл для замены. Ни путь на диске, ни доступ к файлу для следующих вызовов плагин не получает. После диалога и перед записью приложение проверяет, что разрешение и открытый интерфейс ещё действуют.

Для выбранных JSON-документов действует тот же лимит 4 MiB. После неудачной или отменённой записи рядом с выбранным файлом может остаться временный `.sobes-json-*.pending`. Целевой файл меняется только при атомарной фиксации; путь временного файла плагину не передаётся. Ошибка синхронизации после фиксации тоже может завершить вызов ошибкой, как и для собственных файлов.

| Ошибка файла | Условие |
| --- | --- |
| `plugin_invalid_file_name` | Имя файла не соответствует правилам выше. |
| `plugin_file_too_large` | Сериализованный JSON превышает 4 MiB. |
| `plugin_files_quota_exceeded` | Итоговое число собственных файлов или их общий размер превышают квоту. |
| `plugin_invalid_file_json` | Файл не содержит корректный JSON. |
| `plugin_file_unavailable` | Выбранный файл не удалось прочитать или записать. |
| `plugin_file_dialog_requires_interaction` | Нет активного действия пользователя, разрешающего браузеру открыть диалог. |
| `plugin_file_dialog_unavailable` | Вызов сделан вне поддерживаемого React-интерфейса главного окна. |
| `plugin_busy` | Уже открыт другой JSON-диалог. |

Нативный диалог ограничен 300 секундами, ожидание его ответа в интерфейсе плагина 302 секундами. Истечение времени приходит как ошибка, а не как отмена. Перед показом действия с файлом проверяйте соответствующий метод `files.*` через capabilities.

## Буфер обмена, навигация и уведомления

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `clipboard.writeText(text: string)` | `clipboard.write`, `{ text }` | `void` | `clipboard.write` |
| `app.navigate(path: string)` | `app.navigate`, `{ path }` | `void` | `app.navigate` |
| `app.openPage(viewId: string, query?: Record<string, string>)` | `app.openPage`, `{ viewId, query }` | `void` | `app.navigate` |
| `app.openExternal(url: string)` | `app.openExternal`, `{ url }` | `void` | `app.openExternal` |
| `notifications.show(message: string, tone?: "info" \| "success" \| "error")` | `notifications.show`, `{ message, tone }` | `void` | `notifications.show` |

Текст для буфера обмена должен быть непустым и не длиннее 1 000 000 кодовых единиц. Метода чтения буфера обмена нет.

`navigate` принимает пути длиной до 500 кодовых единиц внутри `/meetings`, `/meeting`, `/notes`, `/tracker`, `/progress`, `/settings` и `/plugins`; обратная косая черта запрещена. `openPage` открывает объявленную `app.page` вызывающего плагина. Допустимы до 30 параметров query, ключи до 100 байт UTF-8 и сериализованный объект query до 8 192 байт. Значения query имеют тип string. Идентификатор плагина подставляет хост; этим методом нельзя перейти на страницу другого плагина.

`openExternal` открывает HTTP(S)-адрес в системном браузере. Адрес должен быть непустым, не длиннее 2 000 кодовых единиц, без имени пользователя и пароля. Метод не загружает его содержимое. Уведомление принимает непустое сообщение до 1 000 кодовых единиц; тон по умолчанию равен `"info"`.

## Сетевые запросы

Для потокового HTTP, бинарных ответов и подключения AI SDK через свой `fetch` используйте [`createPluginFetch`](network.md). У простого метода ниже свои, меньшие лимиты.

Требует `network.request` и подходящего имени хоста или маски в `networkDomains`. Ответы HTTP 404 и 500 возвращаются с кодом статуса и телом. Ошибки DNS, доступа и транспорта отклоняют promise.

`network.request(options)` возвращает `{ status: number; body: string; contentType: string }` и требует `network.request`. Имя RPC совпадает с именем метода. Параметры:

```ts
type NetworkOptions = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};
```

| Ограничение | Поведение |
| --- | --- |
| Адрес | HTTPS, порт 443, без учётных данных в URL; подходит под точное имя, `*.example.com` или `*` из [`networkDomains`](network.md#разрешить-домены). |
| DNS | Все полученные адреса должны быть публичными. Хост закрепляет проверенные адреса для соединения. |
| Запрос | GET по умолчанию; доступны только GET и POST. Тело до 1 MiB, не более 32 заголовков. |
| Запрещённые заголовки | `Host`, `Cookie`, `Proxy-Authorization`, `Connection`, `Transfer-Encoding`, `Content-Length`, без учёта регистра. |
| Перенаправления | GET следует не более чем трём, каждый раз проверяя адрес и DNS. Перенаправление POST завершится ошибкой. |
| Таймауты | Пять секунд на соединение и 15 секунд на переход, в пределах общего срока RPC или выполнения. |
| Ответ | До 8 MiB текста UTF-8. Нет бинарного ответа, API заголовков ответа и потока данных. |
| Учётные данные и прокси | Куки и авторизация аккаунта не наследуются. Нативный клиент не использует системный прокси и прокси приложения. Явный заголовок `Authorization` разрешён. |

## Активный оверлей

| Метод SDK | Параметры RPC | Результат | Разрешение |
| --- | --- | --- | --- |
| `overlay.context()` | `overlay.context` | `{ meetingId: string; title: string; mode: string; draft: string }` | `overlay.read` |
| `overlay.setDraft(text: string)` | `overlay.setDraft`, `{ text }` | `void` | `overlay.control` |
| `overlay.insertText(text: string)` | `overlay.insertText`, `{ text }` | `void` | `overlay.control` |

Методы доступны worker и React при активном оверлее встречи. `context().draft` содержит текст поля ввода сообщения. `setDraft` заменяет этот текст; пустая строка очищает поле. `insertText` дописывает текст в конец. Аргумент и итоговый текст ограничены 100 000 байт UTF-8.

Эти вызовы не отправляют сообщение, не включают запись и не запускают генерацию. `context` не возвращает разговор целиком. Панель, открытая для одной встречи, не получает права управлять другой после переключения. Отсутствующий или изменившийся контекст оверлея завершает вызов ошибкой.

## Хелперы только для worker

| Хелпер | Результат | Разрешение |
| --- | --- | --- |
| `meeting.getSelected()` | `PluginMeeting` | `meeting.read` или `meetings.read` |
| `files.exportText(input: { filename: string; text: string })` | `void` | `files.export` |

`getSelected` возвращает `PluginMeeting`: `{ id, title, createdAt, messages: PluginMessage[] }`. Это данные, которые приложение передало команде при запуске, а не обещание загрузить всю сохранённую историю. Если данных встречи при запуске не было, метод завершится ошибкой.

`exportText` подготавливает один Markdown-файл. Имя должно заканчиваться на `.md`, занимать до 180 байт UTF-8, не начинаться с точки и не содержать пути, управляющие символы или `:<>"|?*`. Текст ограничен 16 MiB и общим лимитом ответа обработчика. Диалог сохранения появится после успешного завершения команды. Завершение `await exportText(...)` означает, что экспорт подготовлен; пользователь ещё может отменить сохранение. После диалога хост снова проверит доступ и не перезапишет существующий файл.

React-представления и `ctx.api(...)` не вызывают эти хелперы. Лимиты выполнения описаны в разделе [выполнения и сборки](runtime-and-build.md).

## Ошибки и повторные запросы

После таймаута транспорта результат записи неизвестен: бэкенд мог выполнить операцию. У основного API нет ключа идемпотентности, автоматического повтора, аргумента `AbortSignal` или транзакционного пакета операций.

В React основной API обычно возвращает объект `Error` с кодом в `message`, например `plugin_api_failed`. Клиент API приложения использует структурированный [`PluginApiError`](platform/README.md#ошибки). Ошибки данных, навигации и буфера обмена проходят через главное окно и обычно сводятся к `plugin_api_failed`, включая конфликт заметки или отсутствие записи. Исходную HTTP-ошибку бэкенда разобрать из этого кода нельзя.

| Ошибка | Условие |
| --- | --- |
| `plugin_permission_denied` | У установки нет нужного разрешения. |
| `plugin_disabled` | Плагин отключён. |
| `plugin_session_expired` | Сессия приложения больше не активна. |
| `plugin_execution_cancelled` | Выполнение worker отозвано или отменено. |
| `plugin_unknown_api` | Имя метода отсутствует в реестре API хоста. |
| `plugin_invalid_api_params` | Параметры не соответствуют контракту метода. |
| `plugin_api_failed` | В адаптере хоста завершилась ошибкой операция с ресурсом, навигацией или буфером обмена. |
| `plugin_busy` | Достигнут лимит параллельных вызовов или очереди. |
| `plugin_api_timeout` | Истёк срок ожидания ответа API. Удалённая запись уже могла завершиться. |
| `plugin_view_expired` | Токен доступа интерфейса закрыт или отозван. |
| Нативные ошибки storage и сети | Ошибка проверки, квоты или транспорта. Отклонённый сетевой вызов не содержит HTTP-ответа. |

[Выполнение и сборка](runtime-and-build.md) описывают сроки выполнения и отзыв доступа.
