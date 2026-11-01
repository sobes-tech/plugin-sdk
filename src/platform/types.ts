import type { JsonObject } from "../index";

export const PLUGIN_API_VERSION = 1 as const;

export const PLUGIN_PROTOCOL_VERSION = 1 as const;

export type PlatformFeature = "events" | "data.notes" | "data.tracker";

export type ResourceKind =
  | "meeting"
  | "chat.message"
  | "transcript"
  | "note"
  | "note.folder"
  | "tracker.board"
  | "tracker.column"
  | "tracker.card";

export type ResourceScope =
  | { kind: "selection"; resource: ResourceKind; ids: readonly string[] }
  | { kind: "activeMeeting"; meetingId: string }
  | { kind: "installationCreated"; resource: ResourceKind }
  | { kind: "account"; resource: ResourceKind };

export type GrantOperation =
  "read" | "create" | "update" | "move" | "reorder" | "trash" | "restore" | "export" | "subscribe";

export interface GrantRequest {
  resource: ResourceKind;
  operations: readonly GrantOperation[];
  scopes: readonly ResourceScope["kind"][];
  readFields: readonly string[];
  writeFields: readonly string[];
}

export interface GrantDescriptor {
  id: string;
  revision: string;
  resource: ResourceKind;
  operations: readonly GrantOperation[];
  scope: ResourceScope;
  readFields: readonly string[];
  writeFields: readonly string[];
  expiresAt: string | null;
}

/** Read-only host description. It is never an authority supplied by a plugin. */
export interface HostCapabilities {
  apiVersion: 1;
  protocolVersion: 1;
  features: readonly string[];
  methods: readonly string[];
  grants: readonly GrantDescriptor[];
  transports: { events?: 1 };
  limits?: {
    maxBufferedEvents?: number;
    maxBufferedBytes?: number;
    maxGlobalBufferedBytes?: number;
  };
}

export interface PublicActor {
  kind: "user" | "plugin" | "system";
  installationId?: string;
  packageDigest?: string;
}

/** Sequence is contiguous within the authorized, filtered stream. Token is opaque and confers no permission. */
export interface StreamCursor {
  token: string;
  streamId: string;
  epoch: string;
  seq: number;
}

export type StreamTarget = { kind: "resource"; resource: ResourceKind; ids?: readonly string[] };

export interface PlatformEventPayloads {
  "message.changed": { meetingId: string; messageId: string; revision: string; fields: JsonObject };
  "transcript.partial": {
    meetingId: string;
    segmentId: string;
    revision: string;
    text: string;
    speaker?: string;
  };
  "transcript.final": {
    meetingId: string;
    segmentId: string;
    revision: string;
    text: string;
    speaker?: string;
  };
  "resource.changed": {
    resource: ResourceKind;
    id: string;
    revision: string;
    change: "created" | "updated" | "moved" | "trashed" | "restored";
    fields?: JsonObject;
  };
}

export type PlatformEventKind = keyof PlatformEventPayloads;

export type PlatformEvent<K extends PlatformEventKind = PlatformEventKind> = {
  [E in K]: {
    schemaVersion: 1;
    cursor: StreamCursor;
    eventId: string;
    time: string;
    authority: "host-local";
    actor?: PublicActor;
    kind: E;
    payload: PlatformEventPayloads[E];
  };
}[K];

export interface EventQuery {
  target: StreamTarget;
  kinds?: readonly PlatformEventKind[];
  after?: StreamCursor;
}

export interface EventSnapshot {
  cursor: StreamCursor;
  resources: readonly {
    resource: ResourceKind;
    id: string;
    revision: string;
    fields: JsonObject;
  }[];
}

export type ErrorCode =
  | "unsupported_api_version"
  | "unsupported_feature"
  | "unsupported_transport"
  | "invalid_argument"
  | "invalid_host_response"
  | "permission_denied"
  | "permission_revoked"
  | "scope_denied"
  | "resource_not_found"
  | "revision_conflict"
  | "idempotency_conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "stream_gap"
  | "stream_closed"
  | "buffer_overflow"
  | "cancelled"
  | "host_unavailable";

export interface PublicError {
  code: ErrorCode;
  message?: string;
  retryable: boolean;
  retryAfterMs?: number;
  details?: JsonObject;
}

export interface ResourcePageQuery {
  cursor?: string;
  limit?: number;
  query?: string;
  parentId?: string | null;
  includeTrashed?: boolean;
  fields?: readonly string[];
}

export interface ResourcePage<T> {
  items: T[];
  nextCursor: string | null;
  watermark: string;
}

/** IDs/revisions are stable; fields may be omitted by the granted projection. */
export interface ResourceRecord {
  id: string;
  revision: string;
  updatedAt?: string;
  trashedAt?: string | null;
}

export interface ResourceNote extends ResourceRecord {
  order?: number;
  name?: string;
  content?: string;
  format?: "markdown" | "qa" | "codebase";
  tags?: string[];
  folderId?: string | null;
}

export interface ResourceNoteFolder extends ResourceRecord {
  name?: string;
  order?: number;
}

export interface TrackerBoard extends ResourceRecord {
  title?: string;
}

export interface TrackerColumn extends ResourceRecord {
  boardId?: string;
  title?: string;
  order?: number;
}

export interface TrackerCard extends ResourceRecord {
  order?: number;
  boardId?: string;
  columnId?: string;
  company?: string;
  position?: string;
  notes?: string;
  url?: string | null;
  fields?: JsonObject;
}

export interface CreateResource<T> {
  idempotencyKey: string;
  data: T;
}

export interface ChangeResource<T> {
  id: string;
  expectedRevision: string;
  idempotencyKey: string;
  patch: T;
}

export interface MutateResource {
  id: string;
  expectedRevision: string;
  idempotencyKey: string;
}

export interface MoveResource extends MutateResource {
  destinationId: string | null;
}

export interface ReorderResources {
  parentId: string | null;
  expectedRevision: string;
  idempotencyKey: string;
  ids: readonly string[];
}

export interface ReorderResult {
  revision: string;
  ids: string[];
}

export interface ResourceClient<T extends ResourceRecord, C, U = Partial<C>> {
  list(query?: ResourcePageQuery): Promise<ResourcePage<T>>;
  get(id: string, fields?: readonly string[]): Promise<T>;
  create(input: CreateResource<C>): Promise<T>;
  update(input: ChangeResource<U>): Promise<T>;
  trash(input: MutateResource): Promise<T>;
  restore(input: MutateResource): Promise<T>;
}

export type NoteCreateFields = {
  name: string;
  content?: string;
  format?: "markdown" | "qa";
  tags?: readonly string[];
  folderId?: string | null;
};

export type TrackerCardCreateFields = {
  columnId: string;
  company: string;
  position?: string;
  notes?: string;
  url?: string | null;
  fields?: JsonObject;
};

/** Host supervisor delivers worker events as bounded invocations, not an immortal JS worker. */
export interface WorkerEventDelivery {
  subscriptionId: string;
  deliveryId: string;
  event: PlatformEvent;
}
