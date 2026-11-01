# API приложения

[Документация](../README.md) · [English](../../en/platform/README.md)

Эти методы позволяют читать и изменять заметки и трекер, получать события об изменениях. Десктопное приложение реализует их в API 1. Для доступа нужны выданные права: наличие метода в SDK или capabilities само по себе ничего не разрешает.

| Страница | Возможности | Методы |
| --- | --- | --- |
| [Ресурсы и ревизии](data.md) | `data.notes`, `data.tracker` | 36 |
| [Подписки на события](events.md) | `events` | 4 |

Все 40 методов относятся к API 1. В именах протокола ресурсные операции начинаются с `data.`: например, `data.notes.update`. Основной метод `notes.update` имеет другой контракт.

## Доступность и авторизация

Метод доступен, когда `HostCapabilities.features` содержит его возможность, а `HostCapabilities.methods` — имя метода протокола. Клиент проверяет оба условия перед отправкой операции. Отсутствие возможности или метода возвращает `unsupported_feature`.

Доступность метода не предоставляет права на ресурсы. Хост проверяет разрешённые операции, область действия и поля при каждом запросе.

`createPluginApi(bridge)` и `usePluginApi()` создают клиент без отправки запросов. React-хук `usePluginApi()` импортируется из `@sobes-tech/plugin-sdk/react`. Клиент запрашивает возможности хоста при вызове `capabilities()`, `supports()` или первой операции.

## Права на ресурсы

`manifest.grants` содержит `GrantRequest[]`. Хост получает согласие пользователя и возвращает фактические права в `GrantDescriptor[]` внутри capabilities. Основные `manifest.permissions` проверяются отдельно.

| Поле | Значение |
| --- | --- |
| `resource` | Одно из `meeting`, `chat.message`, `transcript`, `note`, `note.folder`, `tracker.board`, `tracker.column`, `tracker.card`. |
| `operations` | Запрашиваемые операции: `read`, `create`, `update`, `move`, `reorder`, `trash`, `restore`, `export`, `subscribe`. |
| `scopes` | Запрашиваемые виды области доступа: `selection`, `activeMeeting`, `installationCreated`, `account`. Это не идентификаторы аккаунтов и не токены доступа. |
| `readFields`, `writeFields` | Явные списки полей для возвращаемых данных и разрешённых изменений. |

У выданного права есть `id`, `revision`, `resource`, `operations`, `scope`, `readFields`, `writeFields`, `expiresAt: string | null`. Область `scope` имеет одну из форм:

- `{ kind: "selection", resource, ids: readonly string[] }`: выбранные объекты.
- `{ kind: "activeMeeting", meetingId: string }`: активная встреча.
- `{ kind: "installationCreated", resource }`: объекты, созданные этой установкой плагина.
- `{ kind: "account", resource }`: объекты указанного вида в аккаунте.

Пользователь подтверждает доступ в интерфейсе приложения. Выданное право не может быть шире запроса в manifest. `installationCreated` распространяется на объекты, созданные этой установкой плагина. Для `activeMeeting` указанная встреча должна быть активна в контексте вызова.

Например, плагин, которому нужно создавать и редактировать собственные заметки, может добавить в `manifest.grants` такой запрос:

```json
{
  "resource": "note",
  "operations": ["read", "create", "update"],
  "scopes": ["installationCreated"],
  "readFields": ["name", "content", "updatedAt"],
  "writeFields": ["name", "content"]
}
```

После установки читайте фактические права из `capabilities()`: пользователь может разрешить только часть запрошенного.

## Ошибки

`PluginApiError` содержит `code`, `retryable` и необязательные `retryAfterMs`, `details`. Клиент не повторяет записи автоматически.

`revision_conflict` означает несовпадение `expectedRevision` с текущей ревизией. При ошибке соединения или таймауте результат записи может быть неизвестен. Идемпотентный повтор использует исходный запрос и ключ; новый ключ обозначает другую операцию.

| Коды | Значение |
| --- | --- |
| `unsupported_api_version`, `unsupported_feature`, `unsupported_transport` | API, возможность или транспорт недоступны. |
| `invalid_argument`, `invalid_host_response` | Не пройдена проверка параметров запроса или формы ответа. |
| `permission_denied`, `permission_revoked`, `scope_denied`, `resource_not_found` | Доступ запрещён, отозван, выходит за разрешённую область либо ресурс недоступен. |
| `revision_conflict`, `idempotency_conflict` | Изменилась ревизия ресурса либо прежний ключ использован с другими параметрами. |
| `rate_limited`, `quota_exceeded` | Превышен лимит частоты запросов или объёма хранилища. Правила повтора передаются в `retryable` и `retryAfterMs`. |
| `stream_gap`, `buffer_overflow` | Для продолжения обработки нужен новый разрешённый снимок состояния. |
| `stream_closed`, `cancelled`, `host_unavailable` | Прерывание подписки, операции или работы хоста. Запись с неопределённым результатом не откатывается автоматически. |

## Справочник клиента

| Экспорт | Сигнатура или значение |
| --- | --- |
| `createPluginApi` | `(bridge: PluginApiBridge): PluginApi`; создаёт клиент без отправки запроса. |
| `PLUGIN_API_METHODS` | Соответствие 40 имён методов протокола требуемым `PlatformFeature`. |
| `PluginApiMethod` | Псевдоним типа `keyof typeof PLUGIN_API_METHODS`. |

`PluginApiBridge` содержит `call(method: string, params?: JsonValue): Promise<JsonValue>`. Для подписок нужен ещё `events: HostEventTransport`; его устройство описано в [разделе событий](events.md#транспорт-событий).

| Метод | Результат | Поведение |
| --- | --- | --- |
| `capabilities()` | `Promise<HostCapabilities>` | Вызывает `api.capabilities` и кеширует promise, в том числе завершившийся ошибкой. |
| `refreshCapabilities()` | `Promise<HostCapabilities>` | Сбрасывает кешированный promise и повторяет согласование. Не выдаёт доступ и не включает возможность. |
| `supports(feature: PlatformFeature)` | `Promise<boolean>` | Проверяет одну объявленную возможность. Неподдерживаемая версия API даёт `false`; остальные ошибки согласования отклоняют promise. Метод не проверяет отдельную операцию или транспорт. |

Для подписок дополнительно нужны `transports.events === 1` и `bridge.events.version === 1`. Проверка capabilities не заменяет проверку доступа при выполнении операции.

### Ответ capabilities

| Поле | Значение |
| --- | --- |
| `apiVersion` | `1`; другое значение приводит к `unsupported_api_version`. |
| `protocolVersion` | `1`; другое значение приводит к `invalid_host_response`. |
| `features` | Имена объявленных возможностей. Известны три имени из таблицы выше. |
| `methods` | Точные имена реализованных методов. Нужны и метод, и его возможность. |
| `grants` | Выданные хостом `GrantDescriptor[]`. Пустой массив не даёт доступа к ресурсам через эти методы. |
| `transports` | `{ events?: 1 }`. Клиенту также нужен соответствующий транспорт моста. |
| `limits` | Необязательные `{ maxBufferedEvents?: number; maxBufferedBytes?: number }` для [обработчика событий](events.md#ограничения-буфера). |

### Форма публичной ошибки

Конструктор `new PluginApiError(error: PublicError)` принимает `{ code: ErrorCode, message?: string, retryable: boolean, retryAfterMs?: number, details?: JsonObject }`. У экземпляра `name === "PluginApiError"`; если `message` не передан, сообщением становится `code`. Неизвестные ошибки моста клиент приводит к `host_unavailable`. У распознанных ошибок сохраняются код и корректная неотрицательная задержка повтора.

[Типы и права](../../../src/platform/types.ts) · [Методы и проверки](../../../src/platform/client.ts) · [Ошибки](../../../src/platform/errors.ts)
