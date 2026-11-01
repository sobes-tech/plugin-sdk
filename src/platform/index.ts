/** Platform resources and events use the API 1 contract. */
export { PLUGIN_API_METHODS, createPluginApi } from "./client";

export type { PluginApiMethod, PluginApi } from "./client";

export { PluginApiError, normalizePluginApiError } from "./errors";

export type {
  PluginApiBridge,
  EventSubscription,
  HostEventTransport,
  HostStreamConnection,
  HostStreamFrame,
  SubscriptionOptions,
  SubscriptionState,
} from "./stream";

export * from "./types";
