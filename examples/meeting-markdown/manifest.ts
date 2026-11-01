import type { PluginManifest } from "../../src";

export const manifest: PluginManifest = {
  id: "sobes.meeting-markdown",
  version: "1.0.0",
  apiVersion: 1,
  name: { ru: "Встреча в Markdown", en: "Meeting to Markdown" },
  description: {
    ru: "Сохраняет текст выбранной встречи в Markdown. Место сохранения выбираете вы.",
    en: "Exports the selected meeting as Markdown. You choose where to save it.",
  },
  permissions: ["meeting.read", "files.export"],
  commands: [
    {
      id: "export",
      title: { ru: "Экспорт в Markdown", en: "Export to Markdown" },
      location: "meeting",
    },
  ],
  settings: [
    {
      id: "include-answers",
      title: { ru: "Включать ответы Copilot", en: "Include Copilot answers" },
      default: true,
    },
  ],
};
