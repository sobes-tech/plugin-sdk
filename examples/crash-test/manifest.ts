import type { PluginManifest } from "../../src";

export const manifest = {
  id: "sobes.crash-test",
  version: "1.0.1",
  apiVersion: 1,
  name: { en: "Crash Test", ru: "Проверка сбоев" },
  description: {
    en: "Manually trigger plugin errors and a worker timeout to check host isolation.",
    ru: "Ручная проверка изоляции плагина: ошибки JavaScript и таймаут worker.",
  },
  permissions: ["ui.render"],
  commands: [
    {
      id: "worker-throw",
      title: { en: "Test worker exception", ru: "Проверить ошибку worker" },
      location: "settings",
    },
    {
      id: "worker-timeout",
      title: { en: "Test worker timeout", ru: "Проверить таймаут worker" },
      location: "settings",
    },
  ],
  views: [
    {
      id: "main",
      title: { en: "Crash Test", ru: "Проверка сбоев" },
      slot: "app.page",
      renderer: "react",
      icon: "bolt",
    },
  ],
} satisfies PluginManifest;
