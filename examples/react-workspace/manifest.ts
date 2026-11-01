import type { PluginManifest } from "../../src";

export const manifest: PluginManifest = {
  id: "sobes.react-workspace",
  version: "1.0.1",
  apiVersion: 1,
  name: { en: "React workspace", ru: "React-пространство" },
  description: {
    en: "A full React page with meeting search, screenshot gallery and a note editor.",
    ru: "Полноценная React-страница с поиском встреч, галереей и редактором заметок.",
  },
  permissions: ["ui.render", "meetings.read", "screenshots.read", "notes.write"],
  commands: [],
  settings: [
    {
      id: "show-quick-note",
      title: {
        en: "Show quick notes on the workspace page",
        ru: "Показывать быстрые заметки в пространстве",
      },
      default: true,
    },
    {
      id: "note-title",
      title: { en: "Default note title", ru: "Название новой заметки по умолчанию" },
      default: "",
    },
  ],
  views: [
    {
      id: "workspace",
      title: { en: "Workspace", ru: "Пространство" },
      slot: "app.page",
      renderer: "react",
      icon: "layout-dashboard",
    },
    {
      id: "quick-note",
      title: { en: "Quick note", ru: "Быстрая заметка" },
      slot: "notes.header",
      renderer: "react",
      icon: "notebook",
    },
  ],
};
