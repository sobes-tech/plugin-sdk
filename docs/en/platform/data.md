# Resource API

[Documentation](../README.md) · [Platform API](README.md) · [Русский](../../ru/platform/data.md)

Use `api.notes` and `api.tracker` for reads, revision-checked writes, moves, reordering and trash. These are the `data.notes.*` and `data.tracker.*` wire methods. The [core API](../api.md) also has `notes.*` and `tracker.*` methods with different input contracts.

## Concurrency and idempotency

All resource records have an opaque `revision`. Pass the record's revision as `expectedRevision` to `update`, `trash`, `restore` or `move`. The server compares and writes in one transaction; a mismatch returns `revision_conflict`. Reordering uses a list watermark instead, as described below.

Every mutation requires a nonempty `idempotencyKey` identifying one operation. The server retains the result for 24 hours. A retry uses the same key, parameters and authority; reusing a key for a different request produces `idempotency_conflict`. A timeout does not establish whether the write committed. The SDK does not retry it automatically.

`patch` contains only changed fields. Read results can omit fields excluded by the projection or grant. Copying an entire read result into an update can therefore overwrite fields with incomplete data.

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

On `revision_conflict`, read the note again and let your feature resolve the competing change. Do not silently overwrite it with a fresh revision.

## Pagination

`list(query?)` returns `items`, `nextCursor` and `watermark`. Continue with `nextCursor` until it is `null`, preserving filters and projection. Page length is not a completion indicator.

`watermark` is an opaque resource-snapshot marker. It is not a `StreamCursor` and cannot be passed to event subscriptions. [`events.snapshot`](events.md) provides a stream cursor.

The default page size is 50; `limit` must be an integer from 1 to 100. A cursor binds the account data revision, grant scope and query. If data changes while you page, the next request can return `revision_conflict`; restart the listing instead of appending mismatched pages.

## Mutation scope

`trash` and `restore` change the resource's trash state. The API has no permanent-delete method, arbitrary SQL or transaction spanning multiple calls. Separate successful requests do not form an atomic batch.

## Resource reference

All resource results include `id: string` and `revision: string`. They may include `updatedAt: string` and `trashedAt: string | null`. Further fields depend on the permitted projection.

| Resource | SDK group | Additional returned fields |
| --- | --- | --- |
| `ResourceNote` | `api.notes` | Optional `order: number`, `name`, `content`, `format`, `tags: string[]`, `folderId: string \| null` |
| `ResourceNoteFolder` | `api.notes.folders` | Optional `name`, `order: number` |
| `TrackerBoard` | `api.tracker.boards` | Optional `title` |
| `TrackerColumn` | `api.tracker.columns` | Optional `boardId`, `title`, `order: number` |
| `TrackerCard` | `api.tracker.cards` | Optional `order: number`, `boardId`, `columnId`, `company`, `position`, `notes`, `url: string \| null`, `fields: JsonObject` |

Fields are strings unless shown otherwise. Reading a note can return `format: "markdown" | "qa" | "codebase"`. Creation and content edits support `markdown` and `qa`. Codebase content is read-only; folder moves, trash and restore still follow their grants. Requesting codebase creation or content edits returns `unsupported_feature`.

### Reads

`list(query?)` takes a `ResourcePageQuery`:

| Field | Type |
| --- | --- |
| `cursor` | Optional opaque string |
| `limit` | Optional number |
| `query` | Optional string |
| `parentId` | Optional `string \| null` |
| `includeTrashed` | Optional boolean |
| `fields` | Optional `readonly string[]` |

The result is `ResourcePage<T> = { items: T[], nextCursor: string | null, watermark: string }`. The host chooses page limits and permitted fields. `get(id, fields?)` sends `{ id, fields }`. The client checks a nonblank ID and the basic response shape, including resource IDs and revisions. Projected fields remain optional.

### Writes

| Input type | Fields |
| --- | --- |
| `CreateResource<C>` | `{ idempotencyKey: string, data: C }` |
| `ChangeResource<U>` | `{ id: string, expectedRevision: string, idempotencyKey: string, patch: U }` |
| `MutateResource` | `{ id: string, expectedRevision: string, idempotencyKey: string }` |
| `MoveResource` | `MutateResource` plus `{ destinationId: string \| null }` |
| `ReorderResources` | `{ parentId: string \| null, expectedRevision: string, idempotencyKey: string, ids: readonly string[] }` |
| `ReorderResult` | `{ revision: string, ids: string[] }` |

Required IDs, keys and revisions must be nonblank strings. An update patch is `Partial<C>`, where `C` is the creation data for its resource:

| Resource | Create data |
| --- | --- |
| Note | `{ name: string, content?: string, format?: "markdown" \| "qa", tags?: readonly string[], folderId?: string \| null }` |
| Note folder | `{ name: string }` |
| Tracker board | `{ title: string }` |
| Tracker column | `{ boardId: string, title: string }` |
| Tracker card | `{ columnId: string, company: string, position?: string, notes?: string, url?: string \| null, fields?: JsonObject }` |

Read access does not imply write access. The host checks resource ownership, operation, scope and the fields being changed.

Creating or moving an object under a parent also requires read access to that parent. For example, creating a tracker card requires access to its column. Updates may change only granted fields. Changing a note's format also requires its content in the same patch; Q&A content must be valid serialized Q&A data.

Plugin note writes turn off automatic RAG indexing for that note. They do not schedule embeddings or other platform-funded model calls.

### Shared methods

Every resource group has these six methods:

| SDK method | Input | Result |
| --- | --- | --- |
| `list(query?)` | `ResourcePageQuery`; sends `{}` when omitted | `Promise<ResourcePage<T>>` |
| `get(id, fields?)` | Resource ID and optional projection | `Promise<T>` |
| `create(input)` | `CreateResource<C>` | `Promise<T>` |
| `update(input)` | `ChangeResource<Partial<C>>` | `Promise<T>` |
| `trash(input)` | `MutateResource` | `Promise<T>` |
| `restore(input)` | `MutateResource` | `Promise<T>` |

Their 30 wire names are:

| SDK group | Feature | Wire methods |
| --- | --- | --- |
| `api.notes` | `data.notes` | `data.notes.list`, `data.notes.get`, `data.notes.create`, `data.notes.update`, `data.notes.trash`, `data.notes.restore` |
| `api.notes.folders` | `data.notes` | `data.notes.folders.list`, `data.notes.folders.get`, `data.notes.folders.create`, `data.notes.folders.update`, `data.notes.folders.trash`, `data.notes.folders.restore` |
| `api.tracker.boards` | `data.tracker` | `data.tracker.boards.list`, `data.tracker.boards.get`, `data.tracker.boards.create`, `data.tracker.boards.update`, `data.tracker.boards.trash`, `data.tracker.boards.restore` |
| `api.tracker.columns` | `data.tracker` | `data.tracker.columns.list`, `data.tracker.columns.get`, `data.tracker.columns.create`, `data.tracker.columns.update`, `data.tracker.columns.trash`, `data.tracker.columns.restore` |
| `api.tracker.cards` | `data.tracker` | `data.tracker.cards.list`, `data.tracker.cards.get`, `data.tracker.cards.create`, `data.tracker.cards.update`, `data.tracker.cards.trash`, `data.tracker.cards.restore` |

### Moves and reordering

| SDK method | Wire method | Feature | Input and result |
| --- | --- | --- | --- |
| `api.notes.move(input)` | `data.notes.move` | `data.notes` | `MoveResource` → `Promise<ResourceNote>` |
| `api.notes.reorder(input)` | `data.notes.reorder` | `data.notes` | `ReorderResources` → `Promise<ReorderResult>` |
| `api.notes.folders.reorder(input)` | `data.notes.folders.reorder` | `data.notes` | `ReorderResources` → `Promise<ReorderResult>` |
| `api.tracker.columns.reorder(input)` | `data.tracker.columns.reorder` | `data.tracker` | `ReorderResources` → `Promise<ReorderResult>` |
| `api.tracker.cards.move(input)` | `data.tracker.cards.move` | `data.tracker` | `MoveResource` → `Promise<TrackerCard>` |
| `api.tracker.cards.reorder(input)` | `data.tracker.cards.reorder` | `data.tracker` | `ReorderResources` → `Promise<ReorderResult>` |

Notes and cards can move. Notes, folders, columns and cards can be reordered; boards have neither operation. Trash and restore affect application resources, not files on disk.

For `reorder`, read the complete, unfiltered sibling list and use its `watermark` as `expectedRevision`. Supply every visible sibling ID exactly once; the grant must allow `reorder` and writing the `order` field. For notes or folders at the root, list with `parentId: null`; for columns use the board ID, and for cards use the column ID. A search query, `includeTrashed: true`, an incomplete ID list or a list containing ungranted siblings cannot be reordered. Moving a note to `null` puts it at the root; a tracker card needs a destination column.

## Limits

| Value | Limit |
| --- | --- |
| Resources | 10,000 per kind and account, including trashed records |
| Write rate | 120 write requests per minute per installation; idempotent replays are excluded |
| Plugin-created note/card storage | 64 MiB per installation |
| Request or projected response | 1 MiB |
| Note content | 200,000 characters |
| Card notes | 100,000 characters |
| Name, title, company or position | 255 characters |
| Tags | 50 tags, up to 100 characters each |
| Card `fields` | 100 keys, 16 KiB serialized JSON |

Trashing a parent hides its children from ordinary reads without deleting them. Restore the parent before restoring or moving a child into it.
