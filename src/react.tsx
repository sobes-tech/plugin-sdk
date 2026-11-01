import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { createRoot } from "react-dom/client";
import type { JsonObject, JsonValue, PluginContext, PluginFiles } from "./index";
import { createPluginClient } from "./client";
import type { HostEventTransport } from "./platform";

export { usePluginApi } from "./platform/react";

export interface PluginEnvironment {
  viewId: string;
  locale: "ru" | "en";
  settings: Record<string, string | boolean>;
  context: JsonObject;
  theme: "dark" | "light";
  layout?: "page" | "inline" | "control";
  workspace?: { headerTabs: true };
}

export interface WorkspaceHeaderTab {
  id: string;
  label: string;
}

export interface WorkspaceHeaderTabsConfig {
  items: readonly WorkspaceHeaderTab[];
  value: string;
}

export interface WorkspaceHeaderTabsOptions extends WorkspaceHeaderTabsConfig {
  onValueChange: (id: string) => void;
}

export type ReactPluginContext = Omit<
  PluginContext,
  "meeting" | "files" | "input" | "state" | "events"
> & {
  readonly files: PluginFiles;
  readonly events?: HostEventTransport;
} & PluginEnvironment;

interface Bridge {
  events?: HostEventTransport;
  getSnapshot(): PluginEnvironment;
  subscribe(listener: () => void): () => void;
  call(method: string, params?: JsonValue): Promise<JsonValue>;
  workspaceHeader?: {
    set(config: WorkspaceHeaderTabsConfig | null): void;
    subscribe(listener: (id: string) => void): () => void;
  };
}

declare global {
  interface Window {
    __SOBES_PLUGIN_UI__?: Bridge;
  }
}
const Context = createContext<ReactPluginContext | null>(null);

/** Normal React hooks and DOM, inside the host's isolated document. */
export function usePlugin(): ReactPluginContext {
  const value = useContext(Context);

  if (!value) {
    throw new Error("usePlugin requires renderPlugin");
  }

  return value;
}

/** Uses the host workspace header when available; keep inline tabs when false. */
export function useWorkspaceHeaderTabs({
  items,
  value,
  onValueChange,
}: WorkspaceHeaderTabsOptions): boolean {
  const environment = useContext(Context);
  const header =
    typeof window === "undefined" ? undefined : window.__SOBES_PLUGIN_UI__?.workspaceHeader;
  const supported = environment?.workspace?.headerTabs === true && !!header;
  const latest = useRef({ ids: new Set(items.map((item) => item.id)), onValueChange });

  latest.current = { ids: new Set(items.map((item) => item.id)), onValueChange };
  const itemsKey = JSON.stringify(items);

  // Subscribe before publishing, and keep the subscription stable as selection changes.
  useEffect(() => {
    if (!supported || !header) {
      return;
    }

    const unsubscribe = header.subscribe((id) => {
      if (latest.current.ids.has(id)) {
        latest.current.onValueChange(id);
      }
    });

    return () => {
      unsubscribe();
      header.set(null);
    };
  }, [supported, header]);

  useEffect(() => {
    if (supported && header) {
      header.set({ items: JSON.parse(itemsKey) as WorkspaceHeaderTab[], value });
    }
  }, [supported, header, itemsKey, value]);

  return supported;
}

export function renderPlugin(views: Record<string, ComponentType>): () => void {
  const bridge = window.__SOBES_PLUGIN_UI__;

  if (!bridge) {
    throw new Error("React plugins must run inside Sobes");
  }

  const client = createPluginClient(bridge.call);

  function App() {
    const environment = useSyncExternalStore(bridge!.subscribe, bridge!.getSnapshot);
    const View = views[environment.viewId];

    if (!View) {
      throw new Error("Unknown plugin view: " + environment.viewId);
    }

    return createElement(
      Context.Provider,
      { value: { ...client, ...environment, events: bridge!.events } },
      createElement(View),
    );
  }

  const root = createRoot(document.getElementById("root")!);

  root.render(createElement(App));

  return () => root.unmount();
}
