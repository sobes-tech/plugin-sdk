import type { PluginManifest } from "../../src";

export const manifest: PluginManifest = {
  id: "sobes.quick-notes",
  version: "1.0.0",
  apiVersion: 1,
  name: { ru: "Быстрые заметки", en: "Quick notes" },
  description: {
    ru: "Создавайте заметки из собственной формы над библиотекой.",
    en: "Create notes from a custom form above the note library.",
  },
  permissions: ["notes.write", "ui.render"],
  commands: [],
  views: [{ id: "form", title: { ru: "Быстрая заметка", en: "Quick note" }, slot: "notes.header" }],
};
