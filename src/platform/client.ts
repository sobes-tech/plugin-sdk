import type { JsonValue } from "../index";
import { pluginApiError, normalizePluginApiError } from "./errors";
import {
  isStreamCursor,
  openEventSubscription,
  record,
  type PluginApiBridge,
  type EventSubscription,
  type SubscriptionOptions,
} from "./stream";
import type * as T from "./types";

/** Separate wire names prevent accidental dispatch to core mutations. */
export const PLUGIN_API_METHODS = {
  "events.subscribe": "events",
  "events.snapshot": "events",
  "events.acknowledge": "events",
  "events.unsubscribe": "events",
  "data.notes.list": "data.notes",
  "data.notes.get": "data.notes",
  "data.notes.create": "data.notes",
  "data.notes.update": "data.notes",
  "data.notes.trash": "data.notes",
  "data.notes.restore": "data.notes",
  "data.notes.move": "data.notes",
  "data.notes.reorder": "data.notes",
  "data.notes.folders.list": "data.notes",
  "data.notes.folders.get": "data.notes",
  "data.notes.folders.create": "data.notes",
  "data.notes.folders.update": "data.notes",
  "data.notes.folders.trash": "data.notes",
  "data.notes.folders.restore": "data.notes",
  "data.notes.folders.reorder": "data.notes",
  "data.tracker.boards.list": "data.tracker",
  "data.tracker.boards.get": "data.tracker",
  "data.tracker.boards.create": "data.tracker",
  "data.tracker.boards.update": "data.tracker",
  "data.tracker.boards.trash": "data.tracker",
  "data.tracker.boards.restore": "data.tracker",
  "data.tracker.columns.list": "data.tracker",
  "data.tracker.columns.get": "data.tracker",
  "data.tracker.columns.create": "data.tracker",
  "data.tracker.columns.update": "data.tracker",
  "data.tracker.columns.trash": "data.tracker",
  "data.tracker.columns.restore": "data.tracker",
  "data.tracker.columns.reorder": "data.tracker",
  "data.tracker.cards.list": "data.tracker",
  "data.tracker.cards.get": "data.tracker",
  "data.tracker.cards.create": "data.tracker",
  "data.tracker.cards.update": "data.tracker",
  "data.tracker.cards.trash": "data.tracker",
  "data.tracker.cards.restore": "data.tracker",
  "data.tracker.cards.move": "data.tracker",
  "data.tracker.cards.reorder": "data.tracker",
} as const satisfies Record<string, T.PlatformFeature>;

export type PluginApiMethod = keyof typeof PLUGIN_API_METHODS;

export interface PluginApi {
  capabilities(): Promise<T.HostCapabilities>;
  refreshCapabilities(): Promise<T.HostCapabilities>;
  supports(feature: T.PlatformFeature): Promise<boolean>;
  events: {
    subscribe(query: T.EventQuery, options?: SubscriptionOptions): Promise<EventSubscription>;
    snapshot(target: T.StreamTarget): Promise<T.EventSnapshot>;
    acknowledge(
      delivery: Pick<T.WorkerEventDelivery, "subscriptionId" | "deliveryId"> & {
        cursor: T.StreamCursor;
      },
    ): Promise<void>;
    unsubscribe(subscriptionId: string): Promise<void>;
  };
  notes: T.ResourceClient<T.ResourceNote, T.NoteCreateFields> & {
    move(input: T.MoveResource): Promise<T.ResourceNote>;
    reorder(input: T.ReorderResources): Promise<T.ReorderResult>;
    folders: T.ResourceClient<T.ResourceNoteFolder, { name: string }> & {
      reorder(input: T.ReorderResources): Promise<T.ReorderResult>;
    };
  };
  tracker: {
    boards: T.ResourceClient<T.TrackerBoard, { title: string }>;
    columns: T.ResourceClient<T.TrackerColumn, { boardId: string; title: string }> & {
      reorder(input: T.ReorderResources): Promise<T.ReorderResult>;
    };
    cards: T.ResourceClient<T.TrackerCard, T.TrackerCardCreateFields> & {
      move(input: T.MoveResource): Promise<T.TrackerCard>;
      reorder(input: T.ReorderResources): Promise<T.ReorderResult>;
    };
  };
}

function json(value: unknown): JsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? {})) as JsonValue;
  } catch {
    throw pluginApiError("invalid_argument", "Parameters must be JSON-serializable");
  }
}

function nonempty(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw pluginApiError("invalid_argument");
  }
}

function mutation(input: { idempotencyKey: string; expectedRevision?: string }, compare = false) {
  nonempty(input.idempotencyKey);

  if (compare) {
    nonempty(input.expectedRevision);
  }
}

function resource(value: unknown): boolean {
  return record(value) && typeof value.id === "string" && typeof value.revision === "string";
}

/** No calls at construction. Unsupported hosts receive only the core capabilities probe. */
export function createPluginApi(bridge: PluginApiBridge): PluginApi {
  let negotiated: Promise<T.HostCapabilities> | undefined;
  const capabilities = () =>
    (negotiated ??= (async () => {
      let value: JsonValue;

      try {
        value = await bridge.call("api.capabilities", {});
      } catch (error) {
        const code =
          typeof error === "string" ? error : error instanceof Error ? error.message : "";

        if (code === "plugin_unknown_api" || code === "plugin_incompatible_api") {
          throw pluginApiError("unsupported_api_version");
        }

        throw normalizePluginApiError(error);
      }

      if (!record(value) || value.apiVersion !== 1) {
        throw pluginApiError("unsupported_api_version");
      }

      if (
        value.protocolVersion !== 1 ||
        !Array.isArray(value.features) ||
        !value.features.every((v) => typeof v === "string") ||
        !Array.isArray(value.methods) ||
        !value.methods.every((v) => typeof v === "string") ||
        !Array.isArray(value.grants) ||
        !record(value.transports)
      ) {
        throw pluginApiError("invalid_host_response");
      }

      return value as unknown as T.HostCapabilities;
    })());

  const requireMethod = async (method: PluginApiMethod) => {
    const caps = await capabilities();

    if (!caps.features.includes(PLUGIN_API_METHODS[method]) || !caps.methods.includes(method)) {
      throw pluginApiError("unsupported_feature", method);
    }

    return caps;
  };

  const request = async <R>(
    method: PluginApiMethod,
    params: unknown,
    valid?: (value: unknown) => boolean,
  ): Promise<R> => {
    await requireMethod(method);
    let value: JsonValue;

    try {
      value = await bridge.call(method, json(params));
    } catch (error) {
      throw normalizePluginApiError(error);
    }

    if (valid && !valid(value)) {
      throw pluginApiError("invalid_host_response");
    }

    return value as R;
  };

  const subscribe = async (
    method: PluginApiMethod,
    query: T.EventQuery,
    options?: SubscriptionOptions,
  ) => {
    const caps = await requireMethod(method);

    if (caps.transports.events !== 1 || bridge.events?.version !== 1) {
      throw pluginApiError("unsupported_transport");
    }

    return openEventSubscription(bridge.events, method, query, options, caps.limits);
  };

  const crud = <R extends T.ResourceRecord, C>(prefix: string): T.ResourceClient<R, C> => ({
    list: (query) =>
      request(
        `${prefix}.list` as PluginApiMethod,
        query ?? {},
        (value) =>
          record(value) &&
          Array.isArray(value.items) &&
          value.items.every(resource) &&
          (value.nextCursor === null || typeof value.nextCursor === "string") &&
          typeof value.watermark === "string",
      ),
    get: (id, fields) => {
      nonempty(id);

      return request(`${prefix}.get` as PluginApiMethod, { id, fields }, resource);
    },
    create: (input) => {
      mutation(input);

      return request(`${prefix}.create` as PluginApiMethod, input, resource);
    },
    update: (input) => {
      mutation(input, true);
      nonempty(input.id);

      return request(`${prefix}.update` as PluginApiMethod, input, resource);
    },
    trash: (input) => {
      mutation(input, true);
      nonempty(input.id);

      return request(`${prefix}.trash` as PluginApiMethod, input, resource);
    },
    restore: (input) => {
      mutation(input, true);
      nonempty(input.id);

      return request(`${prefix}.restore` as PluginApiMethod, input, resource);
    },
  });

  const move = <R>(method: PluginApiMethod, input: T.MoveResource) => {
    mutation(input, true);
    nonempty(input.id);

    return request<R>(method, input, resource);
  };

  const reorder = (method: PluginApiMethod, input: T.ReorderResources) => {
    mutation(input, true);

    return request<T.ReorderResult>(
      method,
      input,
      (value) =>
        record(value) &&
        typeof value.revision === "string" &&
        Array.isArray(value.ids) &&
        value.ids.every((id) => typeof id === "string"),
    );
  };

  const api: PluginApi = {
    capabilities,
    refreshCapabilities: () => {
      negotiated = undefined;

      return capabilities();
    },
    supports: async (feature) => {
      try {
        return (await capabilities()).features.includes(feature);
      } catch (error) {
        const failure = normalizePluginApiError(error);

        if (failure.code === "unsupported_api_version") {
          return false;
        }

        throw failure;
      }
    },
    events: {
      subscribe: (query, options) => subscribe("events.subscribe", query, options),
      snapshot: (target) =>
        request(
          "events.snapshot",
          { target },
          (value) =>
            record(value) && isStreamCursor(value.cursor) && Array.isArray(value.resources),
        ),
      acknowledge: (input) => {
        nonempty(input.subscriptionId);
        nonempty(input.deliveryId);

        if (!isStreamCursor(input.cursor)) {
          throw pluginApiError("invalid_argument");
        }

        return request("events.acknowledge", input);
      },
      unsubscribe: (subscriptionId) => {
        nonempty(subscriptionId);

        return request("events.unsubscribe", { subscriptionId });
      },
    },
    notes: {
      ...crud<T.ResourceNote, T.NoteCreateFields>("data.notes"),
      move: (input) => move("data.notes.move", input),
      reorder: (input) => reorder("data.notes.reorder", input),
      folders: {
        ...crud<T.ResourceNoteFolder, { name: string }>("data.notes.folders"),
        reorder: (input) => reorder("data.notes.folders.reorder", input),
      },
    },
    tracker: {
      boards: crud<T.TrackerBoard, { title: string }>("data.tracker.boards"),
      columns: {
        ...crud<T.TrackerColumn, { boardId: string; title: string }>("data.tracker.columns"),
        reorder: (input) => reorder("data.tracker.columns.reorder", input),
      },
      cards: {
        ...crud<T.TrackerCard, T.TrackerCardCreateFields>("data.tracker.cards"),
        move: (input) => move("data.tracker.cards.move", input),
        reorder: (input) => reorder("data.tracker.cards.reorder", input),
      },
    },
  };

  return api;
}
