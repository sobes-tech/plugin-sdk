# Event API

[Documentation](../README.md) · [Platform API](README.md) · [Русский](../../ru/platform/events.md)

Use subscriptions to update a plugin view when application data changes. The desktop host supplies the event transport, checks current grants and delivers only the permitted resources and fields.

## Delivery and acknowledgement

`events.snapshot(target)` returns resource state and its `StreamCursor`. Passing that cursor as `after` subscribes to subsequent events, including retained changes between snapshot retrieval and subscription. A resource page's `watermark` is not a stream cursor.

`EventSubscription` is an `AsyncIterableIterator<PlatformEvent>`. At most one `next()` call may be pending. Leaving a `for await` loop invokes `return()` and closes the subscription.

`acknowledge(event)` is cumulative and accepts only events delivered by that subscription. It releases the event and earlier retained events. Acknowledgement represents completed processing, including any required durable write. Unacknowledged events may be redelivered after `resume()`. Idempotency of side effects belongs to the consumer and host mutation contract.

## Cursor and lifecycle

`StreamCursor = { token: string, streamId: string, epoch: string, seq: number }`. All strings are nonempty; `seq` is a nonnegative safe integer. The token is opaque and is not an authorization credential. Sequence numbers are scoped to their stream and epoch.

Sequences must be contiguous in the authorized, filtered stream. The SDK ignores duplicates and older sequence numbers. A gap, changed stream or epoch, or a `resyncRequired` frame produces `stream_gap` and state `resyncRequired`. Recovery requires a new snapshot.

| Member | Type and behavior |
| --- | --- |
| `state` | Read-only `"connecting" \| "open" \| "reconnecting" \| "resyncRequired" \| "failed" \| "closed"` |
| `acknowledgedCursor` | Read-only `StreamCursor \| undefined` |
| `acknowledge(event)` | `Promise<void>`; cumulative acknowledgement |
| `resume(after?)` | `Promise<void>`; reopens from `after` or the last acknowledged cursor |
| `close()` | `Promise<void>`; closes the subscription |

The desktop client keeps the event journal in memory. Subscriptions read that local journal; they do not poll a backend event endpoint. Resource updates come from confirmed API results and changes observed by the app. The native host filters each delivery against the current grants.

The transport owns reconnection and local history retention. Resuming a subscription does not repeat a resource mutation. Closing the subscription stops event delivery.

## Event reference

The four general methods require `events` and their exact wire names:

| SDK method | Wire method | Input | Result |
| --- | --- | --- | --- |
| `api.events.subscribe(query, options?)` | `events.subscribe` | `EventQuery`, local `SubscriptionOptions` | `Promise<EventSubscription>` through the event transport |
| `api.events.snapshot(target)` | `events.snapshot` | `{ target: StreamTarget }` | `Promise<EventSnapshot>` |
| `api.events.acknowledge(delivery)` | `events.acknowledge` | `{ subscriptionId, deliveryId, cursor: StreamCursor }` | `Promise<void>` |
| `api.events.unsubscribe(subscriptionId)` | `events.unsubscribe` | `{ subscriptionId }` | `Promise<void>` |

`EventQuery` is `{ target, kinds?: readonly PlatformEventKind[], after?: StreamCursor }`. A `StreamTarget` is one of:

- `{ kind: "resource", resource: ResourceKind, ids?: readonly string[] }`

Live messages and transcripts observed in an open meeting can use a `local:` revision. It identifies a client observation, not a stored resource revision. Partial transcript revisions are always local. The host filters resources and fields against current grants.

Supported resource targets are `note`, `note.folder`, `tracker.board`, `tracker.column`, `tracker.card`, `meeting`, `chat.message` and `transcript`.

`EventSnapshot` contains `cursor: StreamCursor` and `resources: readonly { resource, id, revision, fields: JsonObject }[]`. The general `events.acknowledge` and `events.unsubscribe` methods address a host-managed subscription by its IDs. An open `EventSubscription` instead has `acknowledge(event)` and `close()`.

### Views and worker handlers

React views get the transport through `usePluginApi()`. In a worker handler, construct the client with `createPluginApi({ call: ctx.api, events: ctx.events })`. The transport exists only for that invocation: subscriptions close when the handler finishes, is cancelled or reaches its execution limit. A worker handler has a 60-second execution limit and a 64-call host API budget. Opening a subscription does not keep the worker alive indefinitely or register a future handler.

Process each event before acknowledging it. If processing writes data, use the event ID as part of your own deduplication key. A replay can deliver that event again.

### Event contents

All events have `schemaVersion: 1`, `cursor`, `eventId`, `time`, `authority: "host-local"`, `kind` and `payload`. Optional `actor` metadata contains `kind: "user" | "plugin" | "system"` and optional `installationId` and `packageDigest`.

| Kind | Payload |
| --- | --- |
| `message.changed` | `{ meetingId, messageId, revision, fields: JsonObject }` |
| `transcript.partial`, `transcript.final` | `{ meetingId, segmentId, revision, text, speaker?: string }` |
| `resource.changed` | `{ resource: ResourceKind, id, revision, change: "created" \| "updated" \| "moved" \| "trashed" \| "restored", fields?: JsonObject }` |

IDs, revisions, names and text are strings unless shown otherwise.

The SDK validates known kinds and basic payload shapes. Applying payload fields is the consumer's responsibility. `host-local` authority does not guarantee durable server replay.

## Buffer limits

Defaults are 64 retained events and 8 MiB of serialized event data. Delivery to your handler does not release an event; acknowledgement does. If the consumer stops acknowledging, a full buffer fails with `buffer_overflow` and enters `resyncRequired`. Recovery requires a new snapshot.

The native host allows up to 16 streams per installation and 64 in the session. Its replay buffer retains at most 1,024 events or 8 MiB per stream and expires after ten minutes without activity. Those are replay limits, separate from the 64-event consumer buffer. Across the native session, retained stream data is capped at 64 MiB. All events produced by this host use `authority: "host-local"`. A cursor does not survive an app restart, a new plugin session or a grant revision. After a realtime disconnect or loss of local history, obtain a fresh snapshot. The client does not reconstruct individual events that happened while it was offline. A remote note or tracker change becomes observable when the app receives or reloads that data; a subscription is not a database change feed.

`SubscriptionOptions` accepts optional `after`, `signal: AbortSignal`, `maxBufferedEvents`, `maxBufferedBytes` and `onStateChange(state)`. `options.after` takes precedence over `query.after`. Each size is the smaller of the consumer and host setting, substituting the default for an omitted value on either side. Sizes must be positive safe integers.

## Event transport

`PluginApiBridge` has `call(method, params?)` and optional `events: HostEventTransport`. Subscriptions require both `capabilities.transports.events === 1` and `bridge.events.version === 1`. Ordinary RPC calls alone cannot supply a stream.

`HostEventTransport.open(request, receive)` takes `{ method, query, limits: { maxBufferedEvents, maxBufferedBytes } }` and returns `Promise<HostStreamConnection>`. The connection has `acknowledge(cursor): Promise<void>` and `close(): Promise<void>`. It delivers these frames to `receive`:

| Frame | Meaning |
| --- | --- |
| `{ type: "event", event: PlatformEvent }` | One event envelope. |
| `{ type: "status", state: "open" \| "reconnecting" }` | Transport state. The native transport owns network reconnection. |
| `{ type: "resyncRequired", reason: "retention_expired" \| "epoch_changed" \| "buffer_overflow" }` | The consumer needs a new snapshot. |
| `{ type: "error", error: PublicError }` | A structured failure. |
| `{ type: "closed" }` | The stream ended. |

Account credentials and access tokens stay with the host, which owns authorization checks and the network connection.
