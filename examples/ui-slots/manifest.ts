import type { LocalizedText, PluginManifest, PluginSlot, PluginViewContribution } from "../../src";

// Record makes a newly added SDK slot a type error until this example covers it.
export const slotDescriptions = {
  "app.sidebar.top": {
    en: "Main navigation, above the links. Not shown in the settings sidebar.",
    ru: "Главная боковая панель, над навигацией. В боковой панели настроек не показывается.",
  },
  "app.sidebar.bottom": {
    en: "Main navigation, below the links. Not shown in the settings sidebar.",
    ru: "Главная боковая панель, под навигацией. В боковой панели настроек не показывается.",
  },
  "app.page": {
    en: "This page. Open UI Slots in the main navigation.",
    ru: "Эта страница. Откройте «UI-слоты» в главной навигации.",
  },
  "meetings.header": { en: "Meetings list, above the list.", ru: "Список встреч, над списком." },
  "meetings.footer": { en: "Meetings list, below the list.", ru: "Список встреч, под списком." },
  "meeting.header": {
    en: "Open a meeting preview; above its content.",
    ru: "Откройте просмотр встречи; над её содержимым.",
  },
  "meeting.overview": {
    en: "Meeting preview, Summary tab after the meeting loads successfully.",
    ru: "Просмотр встречи, вкладка «Сводка» после успешной загрузки встречи.",
  },
  "meeting.footer": {
    en: "Open a meeting preview; below its content.",
    ru: "Откройте просмотр встречи; под её содержимым.",
  },
  "meeting.history": {
    en: "Meeting preview, History tab after messages load. Needs at least one message.",
    ru: "Просмотр встречи, вкладка «История» после загрузки сообщений. Нужно хотя бы одно сообщение.",
  },
  "meeting.gallery": {
    en: "Meeting preview, Gallery tab after screenshots load. Needs at least one screenshot.",
    ru: "Просмотр встречи, вкладка «Галерея» после загрузки скриншотов. Нужен хотя бы один скриншот.",
  },
  "notes.header": { en: "Notes page, above the notes.", ru: "Страница заметок, над заметками." },
  "notes.footer": { en: "Notes page, below the notes.", ru: "Страница заметок, под заметками." },
  "tracker.header": { en: "Tracker page, above the board.", ru: "Страница трекера, над доской." },
  "tracker.footer": { en: "Tracker page, below the board.", ru: "Страница трекера, под доской." },
  "plugins.installed": {
    en: "Plugins settings, Installed tab, below the plugin list.",
    ru: "Настройки плагинов, вкладка «Установленные», под списком плагинов.",
  },
  "overlay.toolbar": {
    en: "Active meeting overlay, toolbar by default. Open this control's popup.",
    ru: "Оверлей активной встречи, по умолчанию на панели инструментов. Откройте попап элемента.",
  },
  "overlay.workspace": {
    en: "Active meeting overlay, toolbar by default. Open this control's docked, resizable workspace panel.",
    ru: "Оверлей активной встречи, по умолчанию на панели инструментов. Откройте закреплённую рабочую панель и измените её размер.",
  },
  "overlay.panel": {
    en: "Active meeting overlay, composer by default. Open this control's popup.",
    ru: "Оверлей активной встречи, по умолчанию в панели ввода. Откройте попап элемента.",
  },
  "overlay.footer": {
    en: "Active meeting overlay, composer by default. Open this control's popup.",
    ru: "Оверлей активной встречи, по умолчанию в панели ввода. Откройте попап элемента.",
  },
  "overlay.message.header": {
    en: "Active meeting overlay, beside a message header. Needs a visible message and an enabled control for its type.",
    ru: "Оверлей активной встречи, рядом с шапкой сообщения. Нужно видимое сообщение и включённый элемент для его типа.",
  },
  "overlay.message.footer": {
    en: "Active meeting overlay, beside a message footer. Needs a visible message and an enabled control for its type.",
    ru: "Оверлей активной встречи, рядом с подвалом сообщения. Нужно видимое сообщение и включённый элемент для его типа.",
  },
} satisfies Record<PluginSlot, LocalizedText>;

export const slotEntries = Object.entries(slotDescriptions) as [PluginSlot, LocalizedText][];

export const inlineViews: PluginViewContribution[] = [
  {
    id: "inline-toggle",
    title: { en: "Inline toggle", ru: "Встроенный переключатель" },
    slot: "overlay.toolbar",
    renderer: "react",
    display: "inline",
    order: 21,
    icon: "bolt",
  },
  {
    id: "inline-action",
    title: { en: "Inline action", ru: "Встроенная кнопка" },
    slot: "overlay.message.footer",
    renderer: "react",
    display: "inline",
    order: 22,
    icon: "star",
  },
];

export const manifest: PluginManifest = {
  id: "sobes.ui-slots",
  version: "1.0.0",
  apiVersion: 1,
  name: { en: "UI Slots", ru: "UI-слоты" },
  description: {
    en: "A labeled marker in every UI slot, plus an inline toggle and action button.",
    ru: "Подписанный маркер в каждом UI-слоте, встроенный переключатель и кнопка.",
  },
  permissions: ["ui.render", "overlay.render"],
  commands: [],
  views: [
    ...slotEntries.map(([slot], order): PluginViewContribution => ({
      id: slot,
      title: slot === "app.page" ? { en: "UI Slots", ru: "UI-слоты" } : { en: slot, ru: slot },
      slot,
      order,
      renderer: "react",
      icon: "puzzle",
    })),
    ...inlineViews,
  ],
};
