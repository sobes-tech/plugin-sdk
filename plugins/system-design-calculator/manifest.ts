import type { PluginManifest } from "../../src";

export const manifest = {
  id: "sobes.system-design-calculator",
  version: "1.0.6",
  apiVersion: 1,
  name: { en: "System Design Calculator", ru: "Калькулятор system design" },
  description: {
    en: "Estimate request rates, bandwidth, storage and cache size in the meeting overlay.",
    ru: "Оценивайте RPS, трафик, хранение и размер кеша прямо в оверлее встречи.",
  },
  permissions: ["overlay.render"],
  commands: [],
  views: [
    {
      id: "calculator",
      title: { en: "Calculator", ru: "Калькулятор" },
      slot: "overlay.workspace",
      renderer: "react",
      icon: "chart",
    },
  ],
} satisfies PluginManifest;
