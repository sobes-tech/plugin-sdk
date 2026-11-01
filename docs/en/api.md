# Core API reference

[Documentation](README.md) | [Русский](../ru/api.md)

The core API is available as `ctx` in worker handlers and through `usePlugin()` in React. All methods in the reference tables return promises; the Result column lists the resolved value. Access is scoped to the authenticated account and the installed plugin's permissions.

This page covers the core RPC methods and worker-local helpers. The resource grants and event methods under `data.*` and `events.*` are documented in the [platform API](platform/README.md). Type aliases below describe argument shapes; they are not additional SDK exports.

## Calling the API

Typed methods, such as `notes.get(id)`, use the same host boundary as low-level calls:

```text
api<T extends JsonValue = JsonValue>(method: string, params?: JsonValue): Promise<T>
```

The generic parameter is a TypeScript assertion. It performs no runtime validation. Low-level calls have the same authorization checks as typed methods.

`api("api.capabilities", {})` returns `apiVersion`, `protocolVersion`, `methods`, `slots`, `permissions`, `features`, `grants`, `transports`. The host reports API 1 and protocol 1. `permissions` contains core manifest permissions; `grants` contains effective resource access, and `transports.events === 1` enables event subscriptions. A method in `methods` indicates implementation support, not authorization.

Typed capability access: `createPluginApi({ call: (method, params) => ctx.api(method, params) }).capabilities()` in a worker, or `usePluginApi().capabilities()` in React. See [platform API](platform/README.md).

## Shared data types

| Type | Fields |
| --- | --- |
| `JsonValue` | `null`, boolean, number, string, arrays of JSON values, or objects containing JSON values. |
| `JsonObject` | A string-keyed object of JSON values. |
| `PageQuery` | `{ cursor?: string; limit?: number; query?: string }`. |
| `Page<T>` | `{ items: T[]; nextCursor: string \| null; total: number }`. |
| `MeetingSummary` | `{ id, title, createdAt, mode, summaryStatus }`, all strings. |
| `PluginMessage` | `{ id?: string; text: string; speaker: string; createdAt: string }`. |
| `NoteRecord` | Required `id`, `name`; optional `content`, `contentHash: string \| null`, `folderId: string \| null`, `updatedAt: string \| null`, `tags: string[]`. |
| `Screenshot` | `{ id: string; meetingId: string; createdAt: string }`. |
| `ScreenshotContent` | `Screenshot` plus `dataUrl: string` and `mimeType: string`. |
| `PluginFileEntry` | `{ path: string; sizeBytes: number }`. |
| `SelectedJsonFile` | `{ name: string; value: JsonValue }`. |

Treat IDs as opaque strings. Most resource ID parameters accept 1 to 128 JavaScript UTF-16 code units; screenshot IDs accept up to 256. Date fields are strings. The API does not expose every internal backend field.

### Pagination

Only `meetings.list`, `notes.list` and `tracker.cards` return `Page<T>`. Use an integer `limit` from 1 to 100; the default is 30. Pass `nextCursor` into the next request without changing the search query. Stop when it is `null`. Pagination does not create a snapshot, so concurrent edits can change later pages.

Pagination example. Required permission: `meetings.read`.

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

## Meetings and screenshots

```ts
type CreateMeeting = {
  title?: string;
  mode?: "interview" | "system_design";
};
```

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `meetings.list(query?: PageQuery)` | `meetings.list`, query or `{}` | `Page<MeetingSummary>` | `meetings.read` |
| `meetings.get(id: string)` | `meetings.get`, `{ id }` | `MeetingSummary & { summary: JsonValue }` | `meetings.read` |
| `meetings.messages(id: string)` | `meetings.messages`, `{ id }` | `PluginMessage[]` | `meetings.read` |
| `meetings.create(input: CreateMeeting)` | `meetings.create`, `input` | `{ id: string }` | `meetings.write` |
| `meetings.rename(id: string, title: string)` | `meetings.rename`, `{ id, title }` | `void` | `meetings.write` |
| `screenshots.list(meetingId: string)` | `screenshots.list`, `{ meetingId }` | `Screenshot[]` | `screenshots.read` |
| `screenshots.get(meetingId: string, id: string)` | `screenshots.get`, `{ meetingId, id }` | `ScreenshotContent` | `screenshots.read` |

Meeting search matches the title without case sensitivity. List results contain summaries, not message bodies. `meetings.get` can return `summary: null`; do not assume the summary is a Markdown string.

`meetings.messages` reads saved message history, projected to text, speaker, date and ID. It does not provide raw audio, image contents, reasoning, live tokens or a live transcript subscription.

When creating a meeting, title defaults to `""` and is truncated to 200 code units. The two listed modes are the only accepted mode values. Renaming requires a nonempty title no longer than 200 code units.

Screenshot IDs refer to images within the specified meeting. They are not reusable download URLs. `screenshots.get` accepts PNG, JPEG, WebP, GIF and BMP images up to 8 MiB. Missing images, failed downloads and unsupported image data reject the promise.

## Notes

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

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `notes.list(query?: PageQuery)` | `notes.list`, query or `{}` | `Page<NoteRecord>` | `notes.read` |
| `notes.get(id: string)` | `notes.get`, `{ id }` | `NoteRecord` | `notes.read` |
| `notes.folders()` | `notes.folders` | `JsonObject[]` | `notes.read` |
| `notes.create(input: CreateNote)` | `notes.create`, `input` | `NoteRecord` | `notes.write` |
| `notes.update(id: string, patch: NotePatch)` | `notes.update`, `{ id, patch }` | `NoteRecord` | `notes.write` |

List results omit content and content hashes. Search matches note names without case sensitivity. `notes.get` supplies content and its hash when available. `notes.folders` returns the current folder `id`, `name` and `order`; it is not paginated.

Creating a note requires a nonempty name of at most 200 code units. Content defaults to `""` and is truncated to 1,000,000 code units. Folder defaults to `null`. Updates can change only name and content; name is truncated to 200 and content to 1,000,000 code units.

Every content update needs the latest nonempty `baseContentHash`, at most 128 code units. A name-only update does not. These methods cannot change tags, move or trash notes, or create or edit folders.

## Tracker and model catalog

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

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `tracker.columns()` | `tracker.columns` | `JsonObject[]` | `tracker.read` |
| `tracker.cards(query?: PageQuery)` | `tracker.cards`, query or `{}` | `Page<JsonObject>` | `tracker.read` |
| `tracker.get(id: string)` | `tracker.get`, `{ id }` | `JsonObject` | `tracker.read` |
| `tracker.create(input: CreateCard)` | `tracker.create`, `input` | `JsonObject` | `tracker.write` |
| `tracker.update(id: string, patch: CardPatch)` | `tracker.update`, `{ id, patch }` | `JsonObject` | `tracker.write` |
| `models.list()` | `models.list` | `JsonValue` | `models.read` |

Columns include `id`, `title`, `sortOrder` and `kind`; the current adapter requests English labels. Card search matches company and position without case sensitivity across the current board's columns. A missing card causes `tracker.get` to fail.

Card creation requires a nonempty `columnId` of at most 128 code units and a nonempty `company` of at most 200. Position defaults to `""`; the backend validates optional URL and notes. Updates truncate company and position to 200 code units and notes to 100,000. They cannot update the URL, move or delete a card, or manage boards.

`models.list` returns provider and model catalog data, which may include custom-provider metadata but not raw keys. Reading this catalog grants neither provider use nor AI generation.

## Storage

Account- and installation-scoped key/value storage. Data is not shared with other plugins or added to the Sobes notes library.

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `storage.get<T extends JsonValue = JsonValue>(key: string)` | `storage.get`, `{ key }` | `T \| null` | Implicit `plugin.storage` |
| `storage.set(key: string, value: JsonValue)` | `storage.set`, `{ key, value }` | `void` | Implicit `plugin.storage` |
| `storage.remove(key: string)` | `storage.remove`, `{ key }` | `void` | Implicit `plugin.storage` |

`get` returns `null` for a missing key. The type parameter does not validate loaded JSON. `set` replaces one value; writing the same value and removing an absent key are no-ops.

Keys occupy 1 to 128 UTF-8 bytes. Each installation can store 256 keys and 256 KiB for the complete serialized map. Data is separated by account, plugin and installation generation. Updating or rolling back a plugin retains its data; uninstalling and reinstalling starts a fresh namespace. Old files may remain on disk.

Storage uses native checkpoints. It is not browser localStorage, encryption or a credential vault. Do not store provider keys or account tokens here. Invalid keys return `plugin_invalid_key`; exceeding the limits returns `plugin_storage_full`. Storage corruption and filesystem failures have their own native error codes.

## JSON files

### Plugin-owned files

Files are stored in the native directory assigned to the current account and plugin installation. `path` is a filename within that directory.

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `files.readJson(path: string)` | `files.readJson`, `{ path }` | `JsonValue \| null` | Implicit `plugin.files` |
| `files.writeJson(path: string, value: JsonValue)` | `files.writeJson`, `{ path, value }` | `void` | Implicit `plugin.files` |
| `files.list()` | `files.list`, `{}` | `PluginFileEntry[]` | Implicit `plugin.files` |

These methods use a native folder private to the current account and plugin installation. `path` is a flat filename such as `settings.json`. It must end in lowercase `.json` and fit in 180 UTF-8 bytes. The host rejects empty stems, hidden names, paths such as `plans/settings.json`, absolute paths, control characters, Windows reserved names and the characters `/\:<>"|?*`. A stem cannot end with a space or dot.

`readJson` returns parsed JSON or `null` if the file is absent. A stored JSON `null` also returns `null`; use `list()` if existence matters. `writeJson` creates or atomically replaces the whole document. `list` returns relative filenames and their serialized sizes in bytes. There are no directory, file-delete or arbitrary-path methods.

| Budget | Limit |
| --- | --- |
| One serialized JSON document | 4 MiB |
| Files in one installation | 1,024 |
| Total serialized file contents | 32 MiB |

Replacing a file charges its resulting size. Quota failure or failure before replacement preserves the previous committed file. If durability syncing fails after the atomic rename, the operation can reject after writing the new contents. Reread before retrying an uncertain write.

Concurrent writes replace whole documents. Serialize read-modify-write operations in the plugin; the API provides no field merge, compare-and-swap or transaction across files. Owned files follow the same account and installation boundaries as storage. They contain plaintext JSON, not vault data.

### User-selected files

Each call opens a system file picker and authorizes access only to the selected file.

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `files.openJson()` | `files.openJson`, `{}` | `SelectedJsonFile \| null` | `files.userSelected` |
| `files.saveJson(filename: string, value: JsonValue)` | `files.saveJson`, `{ filename, value }` | `boolean` | `files.userSelected` |

These methods work only in React views in the main window. Call them from a real user interaction before awaiting other work. Workers, lifecycle handlers and overlay views cannot open the dialogs. A mount effect, timer or synthetic click does not itself create browser user activation. Activation can remain briefly after a real interaction; it is not a persistent grant or proof of one specific click.

Each call opens a system picker. `openJson` returns the selected base name and parsed value, or `null` on cancellation. `saveJson` suggests the supplied filename, then returns `true` after writing or `false` on cancellation. It can replace the selected existing file. Neither method returns an absolute path or reusable file handle, nor grants access to adjacent files. The host rechecks permission and view lifetime after the dialog and at write commit.

Selected JSON documents have the same 4 MiB limit. A failed or cancelled save can leave a `.sobes-json-*.pending` staging file beside the chosen destination. The destination changes only at atomic commit; the plugin does not receive the staging path. A syncing failure after commit can still reject, as with owned files.

| File error | Condition |
| --- | --- |
| `plugin_invalid_file_name` | The filename violates the rules above. |
| `plugin_file_too_large` | Serialized JSON exceeds 4 MiB. |
| `plugin_files_quota_exceeded` | The resulting owned-file count or total size exceeds its quota. |
| `plugin_invalid_file_json` | The file does not contain valid JSON. |
| `plugin_file_unavailable` | The selected file could not be read or written. |
| `plugin_file_dialog_requires_interaction` | No active browser user interaction authorizes the dialog. |
| `plugin_file_dialog_unavailable` | The call originates outside a supported main-window React view. |
| `plugin_busy` | Another JSON picker is open. |

Picker calls have a 300-second native deadline and a 302-second iframe bridge deadline. Expiry rejects instead of returning the cancellation value. Check each exact `files.*` method in capabilities before offering the corresponding file action.

## Clipboard, navigation and notifications

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `clipboard.writeText(text: string)` | `clipboard.write`, `{ text }` | `void` | `clipboard.write` |
| `app.navigate(path: string)` | `app.navigate`, `{ path }` | `void` | `app.navigate` |
| `app.openPage(viewId: string, query?: Record<string, string>)` | `app.openPage`, `{ viewId, query }` | `void` | `app.navigate` |
| `app.openExternal(url: string)` | `app.openExternal`, `{ url }` | `void` | `app.openExternal` |
| `notifications.show(message: string, tone?: "info" \| "success" \| "error")` | `notifications.show`, `{ message, tone }` | `void` | `notifications.show` |

Clipboard text must be nonempty and no longer than 1,000,000 code units. There is no clipboard read method.

`navigate` accepts paths up to 500 code units under `/meetings`, `/meeting`, `/notes`, `/tracker`, `/progress`, `/settings` and `/plugins`; backslashes are forbidden. `openPage` opens a declared `app.page` of the calling plugin. It accepts up to 30 query entries, keys up to 100 UTF-8 bytes, and a serialized query object up to 8,192 bytes. Query values are strings. The host supplies plugin identity; this method cannot target another plugin.

`openExternal` opens an HTTP(S) URL in the system browser. URLs must be nonempty, at most 2,000 code units, and contain no username or password. It does not download the URL. Notifications accept nonempty messages up to 1,000 code units; tone defaults to `"info"`.

## Network requests

For streaming HTTP, binary responses or an AI SDK custom `fetch`, use [`createPluginFetch`](network.md). The buffered convenience method below has its own smaller limits.

Requires `network.request` and a matching hostname or wildcard in `networkDomains`. HTTP error statuses, including 404 and 500, are returned in the response. DNS, authorization and transport failures reject the promise.

`network.request(options)` returns `{ status: number; body: string; contentType: string }` and requires `network.request`. Its RPC name is also `network.request`. Options are:

```ts
type NetworkOptions = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};
```

| Constraint | Behavior |
| --- | --- |
| Destination | HTTPS, port 443, no URL credentials; matches an exact hostname, `*.example.com` or `*` from [`networkDomains`](network.md#declare-access). |
| DNS | Every resolved address must be public. The host pins validated addresses for the connection. |
| Request | GET by default; GET and POST only. Body up to 1 MiB and at most 32 headers. |
| Forbidden headers | `Host`, `Cookie`, `Proxy-Authorization`, `Connection`, `Transfer-Encoding`, `Content-Length`, case-insensitive. |
| Redirects | GET follows at most three, rechecking destination and DNS. POST redirects fail. |
| Timeouts | Five seconds to connect and 15 seconds per hop, within the overall RPC or invocation deadline. |
| Response | Up to 8 MiB of UTF-8 text. No binary response, response-header API or stream. |
| Credentials and proxy | No inherited account cookies or authorization. The native client ignores system and app proxies. Caller-supplied `Authorization` is allowed. |

## Active overlay

| SDK method | RPC parameters | Result | Permission |
| --- | --- | --- | --- |
| `overlay.context()` | `overlay.context` | `{ meetingId: string; title: string; mode: string; draft: string }` | `overlay.read` |
| `overlay.setDraft(text: string)` | `overlay.setDraft`, `{ text }` | `void` | `overlay.control` |
| `overlay.insertText(text: string)` | `overlay.insertText`, `{ text }` | `void` | `overlay.control` |

Available to workers and React views while a meeting overlay is active. `context().draft` is the current message-input text. `setDraft` replaces that text; an empty string clears it. `insertText` appends text. Both the argument and resulting input are limited to 100,000 UTF-8 bytes.

These calls do not send a message, start recording or trigger generation. `context` does not return the complete conversation. An overlay view's lease belongs to one meeting; it cannot act on another meeting after a switch. Missing or changed overlay context rejects the call.

## Worker-only helpers

| Helper | Result | Permission |
| --- | --- | --- |
| `meeting.getSelected()` | `PluginMeeting` | `meeting.read` or `meetings.read` |
| `files.exportText(input: { filename: string; text: string })` | `void` | `files.export` |

`PluginMeeting` is `{ id, title, createdAt, messages: PluginMessage[] }`. This is the selected snapshot supplied to a meeting command. It is not an unrestricted lookup or a guarantee of complete saved history. Without a supplied snapshot, the helper fails.

`exportText` queues one Markdown export for the invocation. Filename must end in `.md`, fit in 180 UTF-8 bytes, not start with `.`, and contain no path separators, control characters or `:<>"|?*`. Text is limited to 16 MiB and the worker's total serialized output limit. The save dialog appears only after successful worker completion. Resolving the helper means queued, not saved; the user can cancel. The host rechecks authorization after the picker and refuses to overwrite an existing file.

React views and `ctx.api(...)` cannot call either helper. See [runtime and build](runtime-and-build.md) for invocation limits.

## Errors and retries

A rejected write has an unknown outcome after a transport timeout: the backend may have committed it. The core API has no idempotency key, automatic retry, `AbortSignal` argument or transactional batch.

Core promises reject with errors. React usually receives an `Error` whose `message` is a code such as `plugin_api_failed`. The platform client uses the structured [`PluginApiError` contract](platform/README.md#errors). The main window handles resource, navigation and clipboard calls; failures generally become `plugin_api_failed`, including note conflicts and missing records. Do not parse backend HTTP errors from that message.

| Error | Condition |
| --- | --- |
| `plugin_permission_denied` | The installation lacks the required permission. |
| `plugin_disabled` | The plugin is disabled. |
| `plugin_session_expired` | The application session is no longer active. |
| `plugin_execution_cancelled` | The worker execution was revoked or cancelled. |
| `plugin_unknown_api` | The method name is not in the host API registry. |
| `plugin_invalid_api_params` | The request parameters do not match the method contract. |
| `plugin_api_failed` | A resource, navigation or clipboard operation failed in the host adapter. |
| `plugin_busy` | A concurrency or queue limit was reached. |
| `plugin_api_timeout` | The API response deadline expired. A remote write may already have completed. |
| `plugin_view_expired` | The view lease was closed or revoked. |
| Native storage and network errors | Validation, quota or transport failure. Network rejection does not contain an HTTP response. |

[Execution limits](runtime-and-build.md) define deadlines and revocation behavior.
