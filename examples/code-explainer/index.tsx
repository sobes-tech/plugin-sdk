/** @jsxImportSource react */
import { useEffect, useMemo, useRef, useState } from "react";
import { renderPlugin, usePlugin } from "../../src/react";
import { Badge, Button, Field, Page, PageHeader, Text, Textarea } from "../../src/components";
import { MarkdownRenderer } from "../../src/markdown";
import { createPluginFetch } from "../../src";
import { ExplanationRun, MAX_CODE_LENGTH, type ExplanationState } from "./generation";
import "./style.css";

const INITIAL: ExplanationState = { phase: "idle", text: "" };
const errors: Record<string, [string, string]> = {
  missing_api_key: [
    "Enter an API key in the plugin settings.",
    "Укажите API-ключ в настройках плагина.",
  ],
  missing_model: [
    "Enter a model ID in the plugin settings.",
    "Укажите ID модели в настройках плагина.",
  ],
  invalid_endpoint: [
    "The URL must use HTTPS and the declared api.openai.com host.",
    "URL должен использовать HTTPS и разрешённый домен api.openai.com.",
  ],
  provider_http_401: ["The provider rejected the API key.", "Провайдер отклонил API-ключ."],
  provider_http_429: [
    "The provider rate limit was reached. Try again later.",
    "Провайдер ограничил частоту запросов. Повторите позже.",
  ],
  response_interrupted: [
    "The connection ended before completion. The partial response is kept below.",
    "Соединение прервалось до завершения. Полученная часть ответа сохранена ниже.",
  ],
  plugin_permission_denied: [
    "Allow network access for this plugin.",
    "Разрешите плагину доступ к сети.",
  ],
};

function CodeExplainer() {
  const plugin = usePlugin();
  const { locale, settings } = plugin;
  const fetch = useMemo(() => createPluginFetch(plugin.api), [plugin.api]);
  const ru = locale === "ru";
  const t = (en: string, russian: string) => (ru ? russian : en);
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(INITIAL);
  const run = useRef<ExplanationRun | null>(null);

  useEffect(() => {
    const operation = new ExplanationRun(fetch, setResult);

    run.current = operation;

    return () => {
      operation.dispose();

      if (run.current === operation) {
        run.current = null;
      }
    };
  }, [fetch]);

  const busy = result.phase === "starting" || result.phase === "running";
  const valid = !!code.trim() && code.length <= MAX_CODE_LENGTH;
  const model = typeof settings.model === "string" ? settings.model : "";
  const endpoint = typeof settings.endpoint === "string" ? settings.endpoint : "";
  const apiKey = typeof settings.apiKey === "string" ? settings.apiKey : "";
  const message = result.error
    ? (errors[result.error] ?? [
        "The request failed. Check the URL, API key and model in the plugin settings.",
        "Запрос не выполнен. Проверьте URL, API-ключ и модель в настройках плагина.",
      ])[ru ? 1 : 0]
    : null;

  const explain = () => {
    if (valid) {
      void run.current?.start(code, question, locale, { endpoint, apiKey, model });
    }
  };

  return (
    <Page width="full" className="ce-page">
      <PageHeader
        title={t("Code Explainer", "Разбор кода")}
        description={t(
          "Paste a function or a small module. Get an explanation and potential pitfalls.",
          "Вставьте функцию или небольшой модуль: получите объяснение и возможные проблемы.",
        )}
      />
      <div className="ce-model">
        <Badge>{model || t("No model configured", "Модель не настроена")}</Badge>
        <Text small muted>
          {t(
            "Configure the URL, API key and model in the plugin settings. Only the text below is sent.",
            "Укажите URL, API-ключ и модель в настройках плагина. Отправляется только текст ниже.",
          )}
        </Text>
      </div>
      <div className="ce-columns">
        <section className="ce-input" aria-label={t("Code input", "Ввод кода")}>
          <Field
            label={t("Code", "Код")}
            description={`${code.length.toLocaleString(locale)} / ${MAX_CODE_LENGTH.toLocaleString(locale)}`}
          >
            <Textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={MAX_CODE_LENGTH}
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              className="ce-code"
              placeholder={t("Paste code here…", "Вставьте код сюда…")}
            />
          </Field>
          <Field
            label={t("What should I focus on?", "На что обратить внимание?")}
            description={t("Optional", "Необязательно")}
          >
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={1000}
              disabled={busy}
              rows={2}
              placeholder={t(
                "For example: race conditions or unnecessary queries",
                "Например: гонки или лишние запросы",
              )}
            />
          </Field>
          <div className="ce-actions">
            <Button disabled={!valid || busy} busy={result.phase === "starting"} onClick={explain}>
              {t("Explain code", "Разобрать код")}
            </Button>
            {busy && (
              <Button variant="outline" onClick={() => run.current?.cancel()}>
                {t("Stop", "Остановить")}
              </Button>
            )}
          </div>
          {message && (
            <p role="alert" className="ce-error">
              {message}
            </p>
          )}
        </section>
        <section className="ce-answer" aria-label={t("Explanation", "Объяснение")} aria-busy={busy}>
          <div className="ce-answer-heading">
            <h2>{t("Explanation", "Объяснение")}</h2>
            <span role="status">
              {result.phase === "completed"
                ? t("Ready", "Готово")
                : result.phase === "cancelled"
                  ? t("Stopped", "Остановлено")
                  : busy
                    ? t("Generating…", "Генерация…")
                    : ""}
            </span>
          </div>
          {result.text ? (
            <MarkdownRenderer content={result.text} isStreaming={busy} answerHighlights={false} />
          ) : (
            <Text muted className="ce-empty">
              {busy
                ? t("Waiting for the model response…", "Жду ответ модели…")
                : t(
                    "Configure your provider and send code to see the explanation.",
                    "Настройте провайдера и отправьте код, чтобы увидеть объяснение.",
                  )}
            </Text>
          )}
        </section>
      </div>
    </Page>
  );
}

renderPlugin({ explain: CodeExplainer });
