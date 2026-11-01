# API ресурсов

[Документация](../README.md) · [API приложения](README.md) · [English](../../en/platform/data.md)

Группы `api.notes` и `api.tracker` позволяют читать, создавать и изменять данные, перемещать объекты, менять порядок и работать с корзиной. В протоколе это методы `data.notes.*` и `data.tracker.*`. У методов `notes.*` и `tracker.*` из [основного API](../api.md) другой контракт параметров.

## Конкурентные изменения и идемпотентность

У каждого объекта есть непрозрачная `revision`. Передавайте её в `expectedRevision` при вызове `update`, `trash`, `restore` или `move`. Сервер сравнивает ревизию и записывает изменение в одной транзакции. Если объект уже изменился, вернётся `revision_conflict`. Для перестановки объектов используется отметка всего списка, а не ревизия отдельной строки.

Для записи нужен непустой `idempotencyKey`. Сервер хранит результат 24 часа. Повторяйте запрос с тем же ключом, параметрами и правами доступа; изменение запроса при прежнем ключе вернёт `idempotency_conflict`. Таймаут не означает, что запись не выполнилась. SDK не повторяет её автоматически.

`patch` содержит только изменяемые поля. В ответе чтения могут отсутствовать поля, исключённые проекцией или правами доступа. Поэтому копирование всего ответа в update может перезаписать ресурс неполными данными.

```ts
import type { PluginApi } from "@sobes-tech/plugin-sdk";

export async function renameNote(
  api: PluginApi,
  noteId: string,
  name: string,
  requestId: string,
) {
  const note = await api.notes.get(noteId);

  return api.notes.update({
    id: note.id,
    expectedRevision: note.revision,
    idempotencyKey: requestId,
    patch: { name },
  });
}
```

При `revision_conflict` заново прочитайте заметку и разрешите конфликт в своём интерфейсе. Подставлять свежую ревизию и молча затирать чужую правку не следует.

## Пагинация

`list(query?)` возвращает `items`, `nextCursor` и `watermark`. Следующая страница запрашивается с `nextCursor` и прежними фильтрами и проекцией. `nextCursor: null` означает конец списка. Количество элементов в странице не определяет, есть ли продолжение.

`watermark` — непрозрачная отметка снимка ресурсов. Она не является `StreamCursor` и не подходит для подписки на события. Курсор потока возвращает [`events.snapshot`](events.md).

По умолчанию страница содержит до 50 объектов; `limit` допускает целое число от 1 до 100. Курсор связан с ревизией данных аккаунта, правами и параметрами выборки. Если во время обхода данные изменились, следующая страница может вернуть `revision_conflict`. В этом случае начните чтение списка заново.

## Область изменений

`trash` и `restore` меняют состояние ресурса в корзине. В API нет безвозвратного удаления, произвольного SQL и транзакции на несколько вызовов. Успешная последовательность запросов не является атомарной.

## Справочник ресурсов

Каждый ресурс содержит `id: string` и `revision: string`; необязательны `updatedAt: string` и `trashedAt: string | null`. Остальные поля зависят от разрешённой выборки.

| Ресурс | Группа SDK | Дополнительные поля ответа |
| --- | --- | --- |
| `ResourceNote` | `api.notes` | Необязательные `order: number`, `name`, `content`, `format`, `tags: string[]`, `folderId: string \| null` |
| `ResourceNoteFolder` | `api.notes.folders` | Необязательные `name`, `order: number` |
| `TrackerBoard` | `api.tracker.boards` | Необязательный `title` |
| `TrackerColumn` | `api.tracker.columns` | Необязательные `boardId`, `title`, `order: number` |
| `TrackerCard` | `api.tracker.cards` | Необязательные `order: number`, `boardId`, `columnId`, `company`, `position`, `notes`, `url: string \| null`, `fields: JsonObject` |

Если тип не указан в таблице, это строка. При чтении `format` заметки может быть `"markdown"`, `"qa"` или `"codebase"`. Создавать и редактировать содержимое можно только в форматах `markdown` и `qa`. У codebase-заметки содержимое доступно только для чтения; перенос между папками и работа с корзиной проверяются по соответствующим правам.

### Параметры чтения

`list(query?)` принимает `ResourcePageQuery`:

| Поле | Тип |
| --- | --- |
| `cursor` | Необязательная непрозрачная строка |
| `limit` | Необязательное число |
| `query` | Необязательная строка |
| `parentId` | Необязательный `string \| null` |
| `includeTrashed` | Необязательный boolean |
| `fields` | Необязательный `readonly string[]` |

Возвращается `ResourcePage<T> = { items: T[], nextCursor: string | null, watermark: string }`. Размер страницы и доступные поля определяет хост. `get(id, fields?)` отправляет `{ id, fields }`. SDK проверяет непустой ID и базовую форму ответа, включая ID и ревизии. Поля проекции остаются необязательными.

### Параметры записи

| Входной тип | Поля |
| --- | --- |
| `CreateResource<C>` | `{ idempotencyKey: string, data: C }` |
| `ChangeResource<U>` | `{ id: string, expectedRevision: string, idempotencyKey: string, patch: U }` |
| `MutateResource` | `{ id: string, expectedRevision: string, idempotencyKey: string }` |
| `MoveResource` | `MutateResource` и `{ destinationId: string \| null }` |
| `ReorderResources` | `{ parentId: string \| null, expectedRevision: string, idempotencyKey: string, ids: readonly string[] }` |
| `ReorderResult` | `{ revision: string, ids: string[] }` |

Ключи, ID и обязательные ревизии должны быть непустыми строками. `patch` имеет тип `Partial<C>`, где `C` описывает поля создания ресурса:

| Ресурс | Данные создания |
| --- | --- |
| Заметка | `{ name: string, content?: string, format?: "markdown" \| "qa", tags?: readonly string[], folderId?: string \| null }` |
| Папка заметок | `{ name: string }` |
| Доска трекера | `{ title: string }` |
| Колонка трекера | `{ boardId: string, title: string }` |
| Карточка трекера | `{ columnId: string, company: string, position?: string, notes?: string, url?: string \| null, fields?: JsonObject }` |

Право чтения не разрешает запись. Хост проверяет операцию, область и каждое записываемое поле, а также владельца объекта.

Чтобы создать или перенести объект внутрь другого, нужно также право чтения родителя. Например, для создания карточки нужен доступ к её колонке. При смене формата заметки передавайте новое содержимое в той же правке. Для `qa` оно должно соответствовать формату сериализованных вопросов и ответов.

Запись заметки через плагин отключает её автоматическое индексирование для RAG. Такие правки не запускают эмбеддинги и другие платные вызовы моделей платформы.

### Общие методы

У каждой группы есть шесть методов:

| Метод SDK | Вход | Результат |
| --- | --- | --- |
| `list(query?)` | `ResourcePageQuery`; без аргумента отправляет `{}` | `Promise<ResourcePage<T>>` |
| `get(id, fields?)` | ID ресурса и необязательная выборка полей | `Promise<T>` |
| `create(input)` | `CreateResource<C>` | `Promise<T>` |
| `update(input)` | `ChangeResource<Partial<C>>` | `Promise<T>` |
| `trash(input)` | `MutateResource` | `Promise<T>` |
| `restore(input)` | `MutateResource` | `Promise<T>` |

Полные имена 30 общих методов:

| Группа SDK | Возможность | Методы протокола |
| --- | --- | --- |
| `api.notes` | `data.notes` | `data.notes.list`, `data.notes.get`, `data.notes.create`, `data.notes.update`, `data.notes.trash`, `data.notes.restore` |
| `api.notes.folders` | `data.notes` | `data.notes.folders.list`, `data.notes.folders.get`, `data.notes.folders.create`, `data.notes.folders.update`, `data.notes.folders.trash`, `data.notes.folders.restore` |
| `api.tracker.boards` | `data.tracker` | `data.tracker.boards.list`, `data.tracker.boards.get`, `data.tracker.boards.create`, `data.tracker.boards.update`, `data.tracker.boards.trash`, `data.tracker.boards.restore` |
| `api.tracker.columns` | `data.tracker` | `data.tracker.columns.list`, `data.tracker.columns.get`, `data.tracker.columns.create`, `data.tracker.columns.update`, `data.tracker.columns.trash`, `data.tracker.columns.restore` |
| `api.tracker.cards` | `data.tracker` | `data.tracker.cards.list`, `data.tracker.cards.get`, `data.tracker.cards.create`, `data.tracker.cards.update`, `data.tracker.cards.trash`, `data.tracker.cards.restore` |

### Перемещение и порядок

| Метод SDK | Метод протокола | Возможность | Вход и результат |
| --- | --- | --- | --- |
| `api.notes.move(input)` | `data.notes.move` | `data.notes` | `MoveResource` → `Promise<ResourceNote>` |
| `api.notes.reorder(input)` | `data.notes.reorder` | `data.notes` | `ReorderResources` → `Promise<ReorderResult>` |
| `api.notes.folders.reorder(input)` | `data.notes.folders.reorder` | `data.notes` | `ReorderResources` → `Promise<ReorderResult>` |
| `api.tracker.columns.reorder(input)` | `data.tracker.columns.reorder` | `data.tracker` | `ReorderResources` → `Promise<ReorderResult>` |
| `api.tracker.cards.move(input)` | `data.tracker.cards.move` | `data.tracker` | `MoveResource` → `Promise<TrackerCard>` |
| `api.tracker.cards.reorder(input)` | `data.tracker.cards.reorder` | `data.tracker` | `ReorderResources` → `Promise<ReorderResult>` |

Перемещать можно заметки и карточки. Перестановка доступна для заметок, папок, колонок и карточек; для досок таких методов нет. `trash` и `restore` работают с ресурсами приложения, а не с файлами на диске.

Для `reorder` сначала прочитайте полный список соседних объектов без поиска и передайте его `watermark` в `expectedRevision`. В `ids` должны быть все видимые соседи, каждый ровно один раз. Нужны право `reorder` и разрешение на запись поля `order`. Для заметок и папок в корне используйте `parentId: null`, для колонок — ID доски, для карточек — ID колонки. Перестановка по результатам поиска, с `includeTrashed: true`, неполным списком ID или недоступными соседями отклоняется. `destinationId: null` переносит заметку в корень; карточке нужна конкретная колонка.

## Лимиты

| Значение | Предел |
| --- | --- |
| Объекты | 10 000 каждого вида на аккаунт, включая корзину |
| Частота правок | 120 запросов на запись в минуту на установку; повторы по ключу идемпотентности не считаются |
| Созданные плагином заметки и карточки | 64 МиБ на установку |
| Запрос или ответ с выбранными полями | 1 МиБ |
| Содержимое заметки | 200 000 символов |
| Заметки карточки | 100 000 символов |
| Название, компания или позиция | 255 символов |
| Теги | До 50 тегов по 100 символов |
| Объект `fields` карточки | 100 ключей, 16 КиБ сериализованного JSON |

Объекты внутри родителя в корзине скрыты из обычной выборки, но не удалены. Восстановите родителя, прежде чем возвращать в него дочерний объект.
