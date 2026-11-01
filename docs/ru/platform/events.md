# API событий

[Документация](../README.md) · [API приложения](README.md) · [English](../../en/platform/events.md)

Подписки позволяют обновлять интерфейс плагина при изменении данных приложения. Транспорт предоставляет десктопное приложение. Оно проверяет действующие права и передаёт только доступные объекты и поля.

## Доставка и подтверждение

`events.snapshot(target)` возвращает состояние ресурсов и его `StreamCursor`. Передача курсора в `after` открывает подписку на последующие события, включая сохранённые изменения между получением снимка и подпиской. Поле `watermark` страницы ресурсов не является курсором потока.

`EventSubscription` реализует `AsyncIterableIterator<PlatformEvent>`. Одновременно может ожидаться только один вызов `next()`. Выход из цикла `for await` вызывает `return()` и закрывает подписку.

`acknowledge(event)` принимает только события этой подписки. Подтверждение накопительное: оно освобождает указанное событие и все предшествующие удерживаемые события. Подтверждение означает завершение обработки, включая необходимую запись данных. Неподтверждённые события могут быть доставлены повторно после `resume()`. Идемпотентность побочных эффектов определяется потребителем и контрактом записи хоста.

## Курсор и жизненный цикл

`StreamCursor = { token: string, streamId: string, epoch: string, seq: number }`. Строки непустые; `seq` — неотрицательное безопасное целое. Токен непрозрачен и не является учётными данными доступа. Номер последовательности имеет смысл только в своём потоке и эпохе.

В разрешённом, отфильтрованном потоке номера должны идти подряд. SDK игнорирует дубликаты и более ранние номера. Пропуск, смена потока или эпохи, а также сообщение `resyncRequired` возвращают `stream_gap` и переводят подписку в `resyncRequired`. Для восстановления нужен новый снимок.

| Член интерфейса | Тип и поведение |
| --- | --- |
| `state` | Read-only `"connecting" \| "open" \| "reconnecting" \| "resyncRequired" \| "failed" \| "closed"` |
| `acknowledgedCursor` | Read-only `StreamCursor \| undefined` |
| `acknowledge(event)` | `Promise<void>`; накопительное подтверждение |
| `resume(after?)` | `Promise<void>`; повторное открытие от `after` или последнего подтверждённого курсора |
| `close()` | `Promise<void>`; закрытие подписки |

Клиент хранит журнал событий в памяти. Подписки читают его и не опрашивают серверный endpoint событий. Изменения ресурсов приходят из подтверждённых ответов API и данных, которые приложение получило или перечитало. Нативный хост проверяет права перед каждой доставкой.

Переподключением и сроком хранения локальной истории управляет транспорт. Возобновление подписки не повторяет запись ресурса. Закрытие подписки останавливает доставку событий.

## Справочник событий

Четыре общих метода требуют `events` и точных имён в capabilities:

| Метод SDK | Метод протокола | Вход | Результат |
| --- | --- | --- | --- |
| `api.events.subscribe(query, options?)` | `events.subscribe` | `EventQuery`, локальные `SubscriptionOptions` | `Promise<EventSubscription>` через транспорт событий |
| `api.events.snapshot(target)` | `events.snapshot` | `{ target: StreamTarget }` | `Promise<EventSnapshot>` |
| `api.events.acknowledge(delivery)` | `events.acknowledge` | `{ subscriptionId, deliveryId, cursor: StreamCursor }` | `Promise<void>` |
| `api.events.unsubscribe(subscriptionId)` | `events.unsubscribe` | `{ subscriptionId }` | `Promise<void>` |

`EventQuery = { target, kinds?: readonly PlatformEventKind[], after?: StreamCursor }`. Цель `StreamTarget`:

- `{ kind: "resource", resource: ResourceKind, ids?: readonly string[] }`

У живых уведомлений о сообщениях и расшифровке открытой встречи ревизия может начинаться с `local:`. Она обозначает наблюдение клиента, а не сохранённую серверную версию. Ревизии промежуточной расшифровки всегда локальные.

Доступные ресурсы: `note`, `note.folder`, `tracker.board`, `tracker.column`, `tracker.card`, `meeting`, `chat.message`, `transcript`. Хост фильтрует объекты и поля по действующим правам.

`EventSnapshot` содержит `cursor: StreamCursor` и `resources: readonly { resource, id, revision, fields: JsonObject }[]`. Общие `events.acknowledge` и `events.unsubscribe` обращаются к подписке хоста по её ID. У открытого объекта `EventSubscription` свои методы: `acknowledge(event)` и `close()`.

### UI и worker

В React транспорт доступен через `usePluginApi()`. В обработчике worker создавайте клиент как `createPluginApi({ call: ctx.api, events: ctx.events })`. Подписка живёт только во время этого вызова обработчика: она закрывается при его завершении, отмене или превышении лимита. На обработчик отведено 60 секунд и 64 вызова API хоста. Подписка не превращает worker в постоянно работающий процесс и не регистрирует обработчик на будущее.

Подтверждайте событие после обработки. Если обработка записывает данные, включайте ID события в свой ключ дедупликации: после восстановления связи то же событие может прийти повторно.

### Данные события

Общие поля: `schemaVersion: 1`, `cursor`, `eventId`, `time`, `authority: "host-local"`, `kind`, `payload`. Необязательный `actor` имеет `kind: "user" | "plugin" | "system"` и может включать `installationId`, `packageDigest`.

| Kind | Payload |
| --- | --- |
| `message.changed` | `{ meetingId, messageId, revision, fields: JsonObject }` |
| `transcript.partial`, `transcript.final` | `{ meetingId, segmentId, revision, text, speaker?: string }` |
| `resource.changed` | `{ resource: ResourceKind, id, revision, change: "created" \| "updated" \| "moved" \| "trashed" \| "restored", fields?: JsonObject }` |



SDK проверяет известные значения `kind` и базовую форму `payload`. Применение полей к модели данных выполняет потребитель. Для события `host-local` не гарантируется долговременная история на сервере.

## Ограничения буфера

По умолчанию клиент удерживает не более 64 событий и 8 МиБ их сериализованных данных. Полученное обработчиком событие занимает буфер до подтверждения. Если обработчик надолго перестал подтверждать события, SDK завершит поток с `buffer_overflow` и перейдёт в `resyncRequired`. Для восстановления нужен новый снимок.

Хост допускает до 16 потоков на установку и 64 на сессию. Для повторной доставки он хранит до 1 024 событий или 8 МиБ на поток; после десяти минут без активности эта история истекает. Это отдельный буфер, не увеличивающий лимит неподтверждённых событий у клиента. Общий объём истории потоков в нативной сессии ограничен 64 МиБ. События этого хоста имеют `authority: "host-local"`. Курсор не переживает перезапуск приложения, новую сессию плагина или смену прав. После обрыва realtime-соединения или потери локальной истории запросите новый снимок. Клиент не восстанавливает отдельные события, пропущенные офлайн. Удалённые изменения заметок и трекера становятся видны, когда приложение получает или перечитывает эти данные; подписка не является журналом изменений всей БД.

В `SubscriptionOptions` можно задать `after`, `signal: AbortSignal`, `maxBufferedEvents`, `maxBufferedBytes` и `onStateChange(state)`. Все поля необязательны; `options.after` важнее `query.after`. Для каждого размера берётся меньшее значение из настроек потребителя и хоста. Пропущенное с любой стороны значение заменяется значением по умолчанию. Размеры должны быть положительными безопасными целыми.

## Транспорт событий

`PluginApiBridge` содержит `call(method, params?)` и необязательный `events: HostEventTransport`. Для подписок нужны одновременно `capabilities.transports.events === 1` и `bridge.events.version === 1`. Один RPC-метод `call` поток не заменяет.

`HostEventTransport.open(request, receive)` принимает `{ method, query, limits: { maxBufferedEvents, maxBufferedBytes } }` и возвращает `Promise<HostStreamConnection>`. У соединения есть `acknowledge(cursor): Promise<void>` и `close(): Promise<void>`. В `receive` приходят:

| Сообщение | Значение |
| --- | --- |
| `{ type: "event", event: PlatformEvent }` | Одно событие. |
| `{ type: "status", state: "open" \| "reconnecting" }` | Состояние транспорта. Переподключением сети управляет нативный транспорт. |
| `{ type: "resyncRequired", reason: "retention_expired" \| "epoch_changed" \| "buffer_overflow" }` | Потребителю нужен новый снимок состояния. |
| `{ type: "error", error: PublicError }` | Структурированная ошибка. |
| `{ type: "closed" }` | Поток завершён. |

Учётные данные аккаунта и токены доступа через этот интерфейс не передаются. Хост сохраняет проверку доступа и управление сетевым соединением у себя.
