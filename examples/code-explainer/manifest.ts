import type { PluginManifest } from "../../src";

export const manifest = {
  id: "sobes.code-explainer",
  version: "1.0.0",
  apiVersion: 1,
  name: { en: "Code Explainer", ru: "Разбор кода" },
  description: {
    en: "Explain pasted code and spot potential problems using your own AI model.",
    ru: "Объясняет вставленный код и находит возможные проблемы через вашу ИИ-модель.",
  },
  permissions: ["ui.render", "network.request"],
  networkDomains: ["api.openai.com"],
  settings: [
    {
      id: "endpoint",
      title: { en: "Chat completions URL", ru: "URL chat completions" },
      default: "https://api.openai.com/v1/chat/completions",
      inputType: "url",
    },
    { id: "apiKey", title: { en: "API key", ru: "API-ключ" }, default: "", inputType: "password" },
    {
      id: "model",
      title: { en: "Model ID", ru: "ID модели" },
      default: "gpt-4.1-mini",
      inputType: "text",
    },
  ],
  commands: [],
  views: [
    {
      id: "explain",
      title: { en: "Code Explainer", ru: "Разбор кода" },
      slot: "app.page",
      renderer: "react",
      icon: "code",
    },
  ],
} satisfies PluginManifest;
