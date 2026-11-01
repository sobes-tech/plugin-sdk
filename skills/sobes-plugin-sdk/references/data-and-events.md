# Account data and live events

Use `usePluginApi()` in React or `createPluginApi({ call: ctx.api, events: ctx.events })` inside a worker handler. These are platform APIs. Do not substitute the core `usePlugin().notes` methods into revision-aware examples.

## Grants for the active meeting

Add this to a React meeting plugin's manifest when it needs message text:

```ts
requiredFeatures: ["events"],
grants: [{
  resource: "chat.message",
  operations: ["read", "subscribe"],
  scopes: ["activeMeeting"],
  readFields: ["meetingId", "text", "role", "createdAt"],
  writeFields: [],
}],
```

`scopes` contains requested scope names, not objects or IDs. The host obtains consent and supplies the effective grant for the bound meeting. A plugin never creates its own grant token. Check `capabilities().grants` when explaining denied access; a method being available does not mean the user granted its data.

The meeting ID comes from context. In React:

```ts
const plugin = usePlugin();
const meetingId = typeof plugin.context.meetingId === "string"
  ? plugin.context.meetingId
  : null;
```

## Snapshot, then subscribe

An event target is a resource selector, not a meeting selector. The effective grant restricts it to the meeting. `ids`, when present, means resource IDs such as message IDs, not a meeting ID.

```ts
import type { EventSubscription, JsonObject, PluginApi } from "@sobes-tech/plugin-sdk";

export async function watchMessages(
  api: PluginApi,
  meetingId: string,
  signal: AbortSignal,
  showSnapshot: (messages: { id: string; fields: JsonObject }[]) => void,
  showMessage: (id: string, fields: JsonObject) => void,
) {
  let stream: EventSubscription | undefined;

  try {
    const target = { kind: "resource", resource: "chat.message" } as const;
    const snapshot = await api.events.snapshot(target);

    if (signal.aborted) return;

    showSnapshot(snapshot.resources
      .filter(row => row.fields.meetingId === meetingId)
      .map(row => ({ id: row.id, fields: row.fields })));

    stream = await api.events.subscribe({
      target,
      kinds: ["message.changed", "resource.changed"],
      after: snapshot.cursor,
    }, { signal });

    for await (const event of stream) {
      if (signal.aborted) return;

      if (event.kind === "message.changed" && event.payload.meetingId === meetingId) {
        showMessage(event.payload.messageId, event.payload.fields);
      } else if (event.kind === "resource.changed"
        && event.payload.resource === "chat.message"
        && event.payload.change === "trashed") {
        showMessage(event.payload.id, {});
      }

      await stream.acknowledge(event);
    }
  } finally {
    await stream?.close().catch(() => {});
  }
}
```

Call this from an effect with an `AbortController`; return `() => controller.abort()` and catch the returned promise. Ignore errors caused by your own cancellation. Display a retry action for other errors. Stop stale callbacks on unmount or meeting change. On `stream_gap` or `buffer_overflow`, discard the old subscription and call the snapshot-and-subscribe function again; do not silently continue with an incomplete state.

`showMessage` receives a field projection. Validate field types and replace the stored text for that message ID; the event contains current text, not an append-only delta. Here an empty object explicitly removes the row. The example listens to both kinds because snapshot-based removals arrive as `resource.changed` with `change: "trashed"`, while live observations can send `message.changed` with empty fields. If an empty projection is ambiguous, refresh the authorized snapshot.

The `showMessage` callback here updates local UI synchronously. If event processing writes data, await that work before acknowledging. Use `eventId` to deduplicate side effects: acknowledgement is cumulative and unacknowledged events may replay. Resource page `watermark` is not an event cursor.

## Transcript events and lifetime

For speech, request a separate `transcript` grant with `read` and `subscribe`, then target `{ kind: "resource", resource: "transcript" }`. Select `transcript.partial` and `transcript.final`. Their payload has `meetingId`, `segmentId`, `revision`, `text` and sometimes `speaker`; they do not have message `fields`. Read the current allowed transcript fields before declaring the grant.

The host relays data the client receives, including meeting updates from Centrifugo. It keeps a bounded in-memory journal and filters each delivery. Do not ask for Centrifugo tokens or open a second connection. Events missed while the app was offline are not a durable replay feed. Revisions starting with `local:` describe client observations, not database revisions suitable for a write.

A React subscription is tied to its view lease. Hiding a visited workspace can leave its iframe mounted; unmounting, disabling, settings changes and session changes can revoke it. Worker subscriptions end with the current handler, which is limited to 60 seconds and 64 host API calls. Do not promise a permanent worker listener.

## Revision-aware writes

For plugin-created notes, a minimal grant is:

```ts
requiredFeatures: ["data.notes"],
grants: [{
  resource: "note",
  operations: ["read", "create", "update"],
  scopes: ["installationCreated"],
  readFields: ["name", "content"],
  writeFields: ["name", "content"],
}],
```

Creation: `api.notes.create({ idempotencyKey, data: { name, content } })`.

Update a loaded record with its own revision:

```ts
const note = await api.notes.get(noteId);
await api.notes.update({
  id: note.id,
  expectedRevision: note.revision,
  idempotencyKey: requestId,
  patch: { content: nextContent },
});
```

Generate `requestId` once for the user operation, outside any retry. Retry an unknown outcome with the same key and parameters. On `revision_conflict`, reload and let the feature resolve the conflict; do not automatically overwrite another edit. Patch only intended fields, since reads may be projected. Follow every `nextCursor` until `null`; do not infer completion from page size. Creating or moving under a parent also needs read access to that parent.

Use the [resource reference](https://github.com/sobes-tech/plugin-sdk/blob/main/docs/en/platform/data.md) for tracker hierarchies, ordering and exact mutation inputs. There is no public arbitrary SQL, multi-call transaction or permanent-delete method.
