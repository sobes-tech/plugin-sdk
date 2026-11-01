import permissionDefinitions from "./permissions.json";
import type { PluginPermission } from "./permissions.generated";
import type {
  GrantDescriptor,
  GrantRequest,
  HostEventTransport,
  PlatformFeature,
} from "./platform";

export type { PluginPermission } from "./permissions.generated";

export * from "./platform";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type LocalizedText = { en: string; ru: string };

export const permissions = permissionDefinitions;

export type PluginLocation = "meeting" | "settings";

export type PluginSlot =
  | "app.sidebar.top"
  | "app.sidebar.bottom"
  | "app.page"
  | "meetings.header"
  | "meetings.footer"
  | "meeting.header"
  | "meeting.overview"
  | "meeting.footer"
  | "meeting.history"
  | "meeting.gallery"
  | "notes.header"
  | "notes.footer"
  | "tracker.header"
  | "tracker.footer"
  | "plugins.installed"
  | "overlay.toolbar"
  | "overlay.workspace"
  | "overlay.panel"
  | "overlay.footer"
  | "overlay.message.header"
  | "overlay.message.footer";

export type PluginEvent =
  | "app.ready"
  | "app.routeChanged"
  | "app.themeChanged"
  | "meeting.opened"
  | "meeting.closed"
  | "meeting.updated"
  | "notes.changed"
  | "tracker.changed";

export interface PluginCommand {
  id: string;
  title: LocalizedText;
  location: PluginLocation;
}

export interface PluginSetting {
  id: string;
  title: LocalizedText;
  default: string | boolean;
  /** Input presentation only. Settings are stored in local JSON, not an encrypted vault. */
  inputType?: "text" | "url" | "password";
}

export type PluginIcon =
  | "layout-dashboard"
  | "file-text"
  | "calendar"
  | "image"
  | "notebook"
  | "chart"
  | "code"
  | "puzzle"
  | "settings"
  | "globe"
  | "search"
  | "list"
  | "folder"
  | "message"
  | "sparkles"
  | "kanban"
  | "terminal"
  | "book"
  | "bolt"
  | "star";

export interface PluginViewContribution {
  id: string;
  title: LocalizedText;
  slot: PluginSlot;
  order?: number;
  renderer?: "react";
  /** Overlay control slots only; omitted keeps the existing popup presentation. */
  display?: "popover" | "inline";
  /** Inline control width in CSS pixels, an integer from 24 to 240. */
  inlineWidth?: number;
  icon?: PluginIcon;
  showInSidebar?: boolean;
}

export interface PluginManifest {
  id: string;
  version: string;
  apiVersion: 1;
  name: LocalizedText;
  description: LocalizedText;
  permissions: PluginPermission[];
  commands: PluginCommand[];
  settings?: PluginSetting[];
  views?: PluginViewContribution[];
  events?: PluginEvent[];
  /** Exact hosts, *.example.com subdomains, or * for any public HTTPS destination. */
  networkDomains?: string[];
  requiredFeatures?: readonly PlatformFeature[];
  grants?: readonly GrantRequest[];
}

export interface PluginUiBundle {
  javascript: string;
  css?: string;
}

export interface PluginPackage {
  manifest: PluginManifest;
  source: string;
  ui?: PluginUiBundle;
}

export interface PluginInstallation {
  manifest: PluginManifest;
  digest: string;
  enabled: boolean;
  grantedPermissions: PluginPermission[];
  settings: Record<string, string | boolean>;
  previousDigest: string | null;
  /** Present when this installation is unavailable; other plugins can still run. */
  error?: string;
  installationId?: string;
  grantRevision?: number;
  resourceGrants?: readonly GrantDescriptor[];
}

export interface PluginPreview {
  manifest: PluginManifest;
  digest: string;
  currentDigest: string | null;
}

export interface PluginMessage {
  id?: string;
  text: string;
  speaker: string;
  createdAt: string;
}

export interface PluginMeeting {
  id: string;
  title: string;
  createdAt: string;
  messages: PluginMessage[];
}

export interface MeetingSummary {
  id: string;
  title: string;
  createdAt: string;
  mode: string;
  summaryStatus: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface PageQuery {
  cursor?: string;
  limit?: number;
  query?: string;
}

export interface Screenshot {
  id: string;
  meetingId: string;
  createdAt: string;
}

export interface ScreenshotContent extends Screenshot {
  dataUrl: string;
  mimeType: string;
}

export interface NoteRecord {
  id: string;
  name: string;
  content?: string;
  contentHash?: string | null;
  folderId?: string | null;
  updatedAt?: string | null;
  tags?: string[];
}

export type PluginElementTag =
  | "stack"
  | "row"
  | "grid"
  | "card"
  | "text"
  | "heading"
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "table"
  | "image"
  | "link"
  | "markdown"
  | "code"
  | "badge"
  | "divider"
  | "progress"
  | "tabs"
  | "spacer";

export type PluginBlock =
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }
  | { type: "button"; label: string; command: string }
  | { type: "element"; tag: PluginElementTag; props: JsonObject; children: PluginBlock[] };

export interface PluginView {
  title: string;
  blocks: PluginBlock[];
  state?: JsonObject;
}

export interface PluginExecution {
  kind: "command" | "view" | "event";
  input?: JsonValue;
  state?: JsonValue;
  context?: JsonObject;
}

export interface ApiCall {
  method: string;
  params: JsonValue;
}

export interface HostCall extends ApiCall {
  requestId: string;
  session: string;
  pluginId: string;
  /** Added by the native host. Sandbox-supplied authority is never accepted. */
  authority?: HostAuthority;
}

export interface HostAuthority {
  accountId: string;
  pluginId: string;
  installationId: string;
  packageDigest: string;
  grantRevision: number;
  grants: readonly GrantDescriptor[];
  activeMeetingId?: string;
  viewToken?: string;
}

export interface PluginFileEntry {
  path: string;
  sizeBytes: number;
}

export interface SelectedJsonFile {
  name: string;
  value: JsonValue;
}

export interface PluginFiles {
  readJson(path: string): Promise<JsonValue | null>;
  writeJson(path: string, value: JsonValue): Promise<void>;
  list(): Promise<PluginFileEntry[]>;
  openJson(): Promise<SelectedJsonFile | null>;
  saveJson(filename: string, value: JsonValue): Promise<boolean>;
}

export interface PluginContext {
  readonly locale: "en" | "ru";
  readonly settings: Readonly<Record<string, string | boolean>>;
  readonly input: JsonValue;
  readonly state: JsonObject;
  readonly context: JsonObject;
  readonly events: HostEventTransport;
  api<T extends JsonValue = JsonValue>(method: string, params?: JsonValue): Promise<T>;
  readonly meeting: { getSelected(): Promise<PluginMeeting> };
  readonly meetings: {
    list(query?: PageQuery): Promise<Page<MeetingSummary>>;
    get(id: string): Promise<MeetingSummary & { summary: JsonValue }>;
    messages(id: string): Promise<PluginMessage[]>;
    create(input: {
      title?: string;
      mode?: "interview" | "system_design";
    }): Promise<{ id: string }>;
    rename(id: string, title: string): Promise<void>;
  };
  readonly screenshots: {
    list(meetingId: string): Promise<Screenshot[]>;
    get(meetingId: string, id: string): Promise<ScreenshotContent>;
  };
  readonly notes: {
    list(query?: PageQuery): Promise<Page<NoteRecord>>;
    get(id: string): Promise<NoteRecord>;
    create(input: {
      name: string;
      content?: string;
      folderId?: string | null;
    }): Promise<NoteRecord>;
    update(
      id: string,
      patch: { name?: string; content?: string; baseContentHash?: string },
    ): Promise<NoteRecord>;
    folders(): Promise<JsonObject[]>;
  };
  readonly tracker: {
    columns(): Promise<JsonObject[]>;
    cards(query?: PageQuery): Promise<Page<JsonObject>>;
    get(id: string): Promise<JsonObject>;
    create(input: {
      columnId: string;
      company: string;
      position?: string;
      url?: string;
      notes?: string;
    }): Promise<JsonObject>;
    update(
      id: string,
      patch: { company?: string; position?: string; notes?: string },
    ): Promise<JsonObject>;
  };
  readonly models: { list(): Promise<JsonValue> };
  readonly storage: {
    get<T extends JsonValue = JsonValue>(key: string): Promise<T | null>;
    set(key: string, value: JsonValue): Promise<void>;
    remove(key: string): Promise<void>;
  };
  readonly clipboard: { writeText(text: string): Promise<void> };
  readonly app: {
    navigate(path: string): Promise<void>;
    openPage(viewId: string, query?: Record<string, string>): Promise<void>;
    openExternal(url: string): Promise<void>;
  };
  readonly notifications: {
    show(message: string, tone?: "info" | "success" | "error"): Promise<void>;
  };
  readonly network: {
    request(options: {
      url: string;
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: string;
    }): Promise<{ status: number; body: string; contentType: string }>;
  };
  readonly overlay: {
    context(): Promise<{ meetingId: string; title: string; mode: string; draft: string }>;
    setDraft(text: string): Promise<void>;
    insertText(text: string): Promise<void>;
  };
  readonly files: PluginFiles & {
    exportText(file: { filename: string; text: string }): Promise<void>;
  };
}

export type PluginHandler = (
  context: PluginContext,
) => PluginView | PluginBlock | void | Promise<PluginView | PluginBlock | void>;

export interface PluginDefinition {
  commands?: Record<string, PluginHandler>;
  views?: Record<string, PluginHandler>;
  events?: Partial<Record<PluginEvent, PluginHandler>>;
}

export function definePlugin(definition: PluginDefinition): void {
  const register = (
    globalThis as unknown as { __sobesRegister?: (value: PluginDefinition) => void }
  ).__sobesRegister;

  if (!register) {
    throw new Error("Plugin bundles must run inside Sobes");
  }

  register(definition);
}

export function localized(text: LocalizedText, locale: string): string {
  return locale.toLowerCase().startsWith("ru") ? text.ru : text.en;
}

export { createPluginFetch, type PluginFetch } from "./network-fetch";
