# Platform API

[Documentation](../README.md) · [Русский](../../ru/platform/README.md)

Use these methods to work with notes and tracker data and subscribe to changes. They are implemented by the desktop host in API 1. Access requires a grant: importing the SDK or seeing a method in capabilities does not give a plugin access to account data.

| Page | Features | Methods |
| --- | --- | --- |
| [Resources and revisions](data.md) | `data.notes`, `data.tracker` | 36 |
| [Event subscriptions](events.md) | `events` | 4 |

All 40 methods belong to API 1. Resource wire names have a `data.` prefix. For example, `data.notes.update` is the revision-aware operation described here; core `notes.update` has its own contract.

## Availability and authorization

A method is available when `HostCapabilities.features` contains its feature and `HostCapabilities.methods` contains its wire name. Each client operation checks both conditions before dispatch. A missing feature or method produces `unsupported_feature`.

Method availability does not grant access to resources. The host checks granted operations, scope and fields for every request.

`createPluginApi(bridge)` and `usePluginApi()` construct a client without sending requests. `usePluginApi()` is a React hook from `@sobes-tech/plugin-sdk/react`. Negotiation starts with `capabilities()`, `supports()` or the first operation.

## Grants

`manifest.grants` contains `GrantRequest[]`. The host obtains consent and returns the effective authority as `GrantDescriptor[]` in capabilities. Core `manifest.permissions` are checked separately.

| Field | Meaning |
| --- | --- |
| `resource` | One of `meeting`, `chat.message`, `transcript`, `note`, `note.folder`, `tracker.board`, `tracker.column`, `tracker.card`. |
| `operations` | Requested operations: `read`, `create`, `update`, `move`, `reorder`, `trash`, `restore`, `export`, `subscribe`. |
| `scopes` | Requested scope kinds: `selection`, `activeMeeting`, `installationCreated`, `account`. These are not account IDs or grant tokens. |
| `readFields`, `writeFields` | Explicit field lists for returned data and permitted changes. |

A returned grant has `id`, `revision`, `resource`, `operations`, `scope`, `readFields`, `writeFields`, `expiresAt: string | null`. The scope is one of:

- `{ kind: "selection", resource, ids: readonly string[] }` for selected objects.
- `{ kind: "activeMeeting", meetingId: string }` for the active meeting.
- `{ kind: "installationCreated", resource }` for objects created by this installation.
- `{ kind: "account", resource }` for that resource kind across the account.

The user approves grants in the application's permission UI. A grant must fit the manifest request; the plugin cannot widen it. An `installationCreated` grant covers objects created by that installation. An `activeMeeting` grant also requires the named meeting to be active in the calling host context.

Read results may omit fields excluded by the grant. Update patches contain only intended changes. The host derives account, installation, package and origin and enforces ownership and revocation.

For example, a plugin that creates and edits its own notes can request:

```json
{
  "resource": "note",
  "operations": ["read", "create", "update"],
  "scopes": ["installationCreated"],
  "readFields": ["name", "content", "updatedAt"],
  "writeFields": ["name", "content"]
}
```

Put this object in `manifest.grants`. Read the effective grants from `capabilities()` after installation; they may be narrower than the request.

## Errors

`PluginApiError` contains `code`, `retryable`, and optional `retryAfterMs` and `details`. The client does not retry mutations automatically.

`revision_conflict` means `expectedRevision` no longer matches. A connection error or timeout can leave the outcome unknown. An idempotent retry uses the original request and key; a new key identifies another operation.

| Codes | Meaning |
| --- | --- |
| `unsupported_api_version`, `unsupported_feature`, `unsupported_transport` | The required API, feature or transport is unavailable. |
| `invalid_argument`, `invalid_host_response` | Request or response validation failed. |
| `permission_denied`, `permission_revoked`, `scope_denied`, `resource_not_found` | Access is denied, revoked, out of scope, or the resource is unavailable. |
| `revision_conflict`, `idempotency_conflict` | The resource revision changed or the same key was used for different parameters. |
| `rate_limited`, `quota_exceeded` | Request rate or storage quota restriction; retry policy is carried by `retryable` and `retryAfterMs`. |
| `stream_gap`, `buffer_overflow` | The event consumer requires a new authorized snapshot. |
| `stream_closed`, `cancelled`, `host_unavailable` | Subscription, operation or host lifecycle interruption; an uncertain write is not implicitly rolled back. |

## Client reference

| Export | Signature or value |
| --- | --- |
| `createPluginApi` | `(bridge: PluginApiBridge): PluginApi`; creates the platform client without sending a request. |
| `PLUGIN_API_METHODS` | Mapping of the 40 platform wire method names to their required `PlatformFeature`. |
| `PluginApiMethod` | Type alias `keyof typeof PLUGIN_API_METHODS`. |

The bridge signature is `call(method: string, params?: JsonValue): Promise<JsonValue>`. Subscriptions additionally use `events: HostEventTransport`, described under [event transport](events.md#event-transport).

| Method | Result | Behavior |
| --- | --- | --- |
| `capabilities()` | `Promise<HostCapabilities>` | Calls `api.capabilities` and caches its promise, including a rejected promise. |
| `refreshCapabilities()` | `Promise<HostCapabilities>` | Clears the cached promise and negotiates again. It does not grant access or enable a feature. |
| `supports(feature: PlatformFeature)` | `Promise<boolean>` | Checks one advertised feature. An unsupported API version returns `false`; other negotiation errors reject. It does not check a specific method or transport. |

Subscriptions additionally require `transports.events === 1` and `bridge.events.version === 1`. Operation-level checks remain authoritative after capability inspection.

### Capability response

| Field | Value |
| --- | --- |
| `apiVersion` | `1`; another value causes `unsupported_api_version`. |
| `protocolVersion` | `1`; another value causes `invalid_host_response`. |
| `features` | Advertised feature names. Known names are the three listed above. |
| `methods` | Exact implemented method names. Both the method and its feature must be present. |
| `grants` | Host-issued `GrantDescriptor[]`. An empty array grants no access to resources through these methods. |
| `transports` | `{ events?: 1 }`. The client also needs the matching bridge transport. |
| `limits` | Optional `{ maxBufferedEvents?: number; maxBufferedBytes?: number }` for the [event consumer](events.md#buffer-limits). |

### Public error shape

`new PluginApiError(error: PublicError)` accepts `{ code: ErrorCode, message?: string, retryable: boolean, retryAfterMs?: number, details?: JsonObject }`. Instances have `name === "PluginApiError"` and use `code` as the message when none is supplied. Unrecognized bridge failures become `host_unavailable`. Recognized failures retain their code and a valid nonnegative retry delay.

[Types and grants](../../../src/platform/types.ts) · [Methods and validation](../../../src/platform/client.ts) · [Errors](../../../src/platform/errors.ts)
