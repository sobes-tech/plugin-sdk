import type { JsonValue, PluginContext, PluginFiles } from "./index";

export function createPluginClient(
  call: (method: string, params?: JsonValue) => Promise<JsonValue>,
) {
  const api = <T = JsonValue>(method: string, params?: JsonValue) =>
    call(method, params) as Promise<T>;
  const client: Omit<
    PluginContext,
    "locale" | "settings" | "context" | "input" | "state" | "meeting" | "files" | "events"
  > & { readonly files: PluginFiles } = {
    api,
    meetings: {
      list: (query) => api("meetings.list", query ? { ...query } : {}),
      get: (id) => api("meetings.get", { id }),
      messages: (id) => api("meetings.messages", { id }),
      create: (input) => api("meetings.create", input),
      rename: async (id, title) => {
        await api("meetings.rename", { id, title });
      },
    },
    screenshots: {
      list: (meetingId) => api("screenshots.list", { meetingId }),
      get: (meetingId, id) => api("screenshots.get", { meetingId, id }),
    },
    notes: {
      list: (query) => api("notes.list", query ? { ...query } : {}),
      get: (id) => api("notes.get", { id }),
      create: (input) => api("notes.create", input),
      update: (id, patch) => api("notes.update", { id, patch }),
      folders: () => api("notes.folders"),
    },
    tracker: {
      columns: () => api("tracker.columns"),
      cards: (query) => api("tracker.cards", query ? { ...query } : {}),
      get: (id) => api("tracker.get", { id }),
      create: (input) => api("tracker.create", input),
      update: (id, patch) => api("tracker.update", { id, patch }),
    },
    models: { list: () => api("models.list") },
    storage: {
      get: (key) => api("storage.get", { key }),
      set: async (key, value) => {
        await api("storage.set", { key, value });
      },
      remove: async (key) => {
        await api("storage.remove", { key });
      },
    },
    files: {
      readJson: (path) => api("files.readJson", { path }),
      writeJson: async (path, value) => {
        await api("files.writeJson", { path, value });
      },
      list: () => api("files.list", {}),
      openJson: () => api("files.openJson", {}),
      saveJson: (filename, value) => api("files.saveJson", { filename, value }),
    },
    clipboard: {
      writeText: async (text) => {
        await api("clipboard.write", { text });
      },
    },
    app: {
      navigate: async (path) => {
        await api("app.navigate", { path });
      },
      openPage: async (viewId, query = {}) => {
        await api("app.openPage", { viewId, query });
      },
      openExternal: async (url) => {
        await api("app.openExternal", { url });
      },
    },
    notifications: {
      show: async (message, tone = "info") => {
        await api("notifications.show", { message, tone });
      },
    },
    network: { request: (options) => api("network.request", options) },
    overlay: {
      context: () => api("overlay.context"),
      setDraft: async (text) => {
        await api("overlay.setDraft", { text });
      },
      insertText: async (text) => {
        await api("overlay.insertText", { text });
      },
    },
  };

  return client;
}
