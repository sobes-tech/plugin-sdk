import type { PluginManifest } from "../../src";

export const manifest: PluginManifest = {
  id: "sobes.overlay-notepad",
  version: "1.0.1",
  apiVersion: 1,
  name: { en: "Overlay notepad", ru: "Блокнот оверлея" },
  description: {
    en: "Keep a scratch note next to the active meeting and insert it into the draft.",
    ru: "Заметки рядом с активной встречей и вставка текста в черновик.",
  },
  permissions: ["overlay.render", "overlay.read", "overlay.control"],
  commands: [],
  settings: [
    {
      id: "show-meeting-title",
      title: { en: "Show the meeting title", ru: "Показывать название встречи" },
      default: true,
    },
    {
      id: "note-label",
      title: {
        en: "Custom note label (empty for default)",
        ru: "Название поля заметки (пустое — стандартное)",
      },
      default: "",
    },
  ],
  views: [
    {
      id: "notepad",
      title: { en: "Notepad", ru: "Блокнот" },
      slot: "overlay.panel",
      renderer: "react",
      icon: "notebook",
    },
    {
      id: "message-note",
      title: { en: "Message note", ru: "Заметка к сообщению" },
      slot: "overlay.message.footer",
      renderer: "react",
      icon: "notebook",
    },
  ],
};
