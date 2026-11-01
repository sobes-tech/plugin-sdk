import type { PluginManifest } from "../../src";

export const manifest: PluginManifest = {
  id: "sobes.meeting-library",
  version: "1.0.1",
  apiVersion: 1,
  name: { ru: "Библиотека встреч", en: "Meeting library" },
  description: {
    ru: "Список встреч, поиск и просмотр скриншотов в собственном интерфейсе.",
    en: "Search meetings and browse screenshots in a custom interface.",
  },
  permissions: ["meetings.read", "screenshots.read", "app.navigate", "ui.render"],
  commands: [],
  settings: [
    {
      id: "show-dates",
      title: { en: "Show meeting and message dates", ru: "Показывать даты встреч и сообщений" },
      default: true,
    },
    {
      id: "show-answers",
      title: { en: "Show Copilot answers in history", ru: "Показывать ответы Copilot в истории" },
      default: true,
    },
  ],
  views: [
    {
      id: "library",
      title: { ru: "Библиотека встреч", en: "Meeting library" },
      slot: "app.page",
      renderer: "react",
      icon: "calendar",
    },
    {
      id: "history",
      title: { ru: "История встречи", en: "Meeting history" },
      slot: "app.page",
      renderer: "react",
      icon: "message",
      showInSidebar: false,
    },
    {
      id: "gallery",
      title: { ru: "Скриншоты встречи", en: "Meeting screenshots" },
      slot: "meeting.overview",
      renderer: "react",
      icon: "image",
      order: 10,
    },
  ],
};
