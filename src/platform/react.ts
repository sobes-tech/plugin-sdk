import { useMemo } from "react";
import { createPluginApi, type PluginApiBridge, type PluginApi } from "./index";

/** Creates a platform client that negotiates API 1 capabilities on first use. */
export function usePluginApi(): PluginApi {
  const bridge =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { __SOBES_PLUGIN_UI__?: PluginApiBridge }).__SOBES_PLUGIN_UI__;

  return useMemo(
    () =>
      createPluginApi(
        bridge ?? {
          call: async () => {
            throw "plugin_incompatible_api";
          },
        },
      ),
    [bridge],
  );
}
