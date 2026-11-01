import { definePlugin } from "../../src";

definePlugin({
  commands: {
    "worker-throw": () => {
      throw new Error("Crash Test: deliberate worker error");
    },
    "worker-timeout": () => {
      for (;;) {
        // Intentionally bounded by the host's normal CPU timeout, with no allocations or RPCs.
      }
    },
  },
});
