/** @jsxImportSource react */
import { useState } from "react";
import { renderPlugin, usePlugin, useWorkspaceHeaderTabs } from "../../src/react";
import { Button, Field, Input, Tabs } from "../../src/components";
import {
  calculate,
  DEFAULT_INPUTS,
  formatBytes,
  formatNumber,
  type InputKey,
  type Inputs,
} from "./model";
import "./style.css";

type Section = "load" | "network" | "storage" | "cache";

type Label = readonly [en: string, ru: string];

const fields: Record<Section, { key: InputKey; label: Label; unit?: Label }[]> = {
  load: [
    {
      key: "dau",
      label: ["Daily active users", "Активных в день"],
      unit: ["users", "пользователей"],
    },
    {
      key: "requestsPerUser",
      label: ["Requests per user", "Запросов на человека"],
      unit: ["per day", "в день"],
    },
    {
      key: "peakMultiplier",
      label: ["Peak multiplier", "Множитель пика"],
      unit: ["× average", "× среднего"],
    },
  ],
  network: [
    { key: "requestKiB", label: ["Request size", "Размер запроса"], unit: ["KiB", "КиБ"] },
    { key: "responseKiB", label: ["Response size", "Размер ответа"], unit: ["KiB", "КиБ"] },
  ],
  storage: [
    { key: "writesPercent", label: ["Write requests", "Доля записей"], unit: ["0–100%", "0–100%"] },
    { key: "recordKiB", label: ["New record size", "Размер новой записи"], unit: ["KiB", "КиБ"] },
    { key: "retentionDays", label: ["Retention", "Срок хранения"], unit: ["days", "дней"] },
    {
      key: "replicas",
      label: ["Data copies", "Копий данных"],
      unit: ["incl. primary", "включая основную"],
    },
    {
      key: "storageOverheadPercent",
      label: ["Storage overhead", "Запас хранения"],
      unit: ["%", "%"],
    },
  ],
  cache: [
    {
      key: "hotKeys",
      label: ["Working-set keys", "Ключей в кеше"],
      unit: ["unique keys", "уникальных"],
    },
    { key: "cacheObjectKiB", label: ["Object size", "Размер объекта"], unit: ["KiB", "КиБ"] },
    { key: "cacheOverheadPercent", label: ["Memory overhead", "Запас памяти"], unit: ["%", "%"] },
    {
      key: "cacheHitPercent",
      label: ["Cache hit rate", "Попадания в кеш"],
      unit: ["0–100%", "0–100%"],
    },
    {
      key: "cacheCopies",
      label: ["Cache copies", "Копий кеша"],
      unit: ["incl. primary", "включая основную"],
    },
  ],
};
const sections: { value: Section; label: Label }[] = [
  { value: "load", label: ["RPS", "RPS"] },
  { value: "network", label: ["Network", "Сеть"] },
  { value: "storage", label: ["Storage", "Данные"] },
  { value: "cache", label: ["Cache", "Кеш"] },
];
const integerFields = new Set<InputKey>(["dau", "replicas", "hotKeys", "cacheCopies"]);

function Parameter({
  field,
  value,
  invalid,
  ru,
  onChange,
}: {
  field: (typeof fields)[Section][number];
  value: string;
  invalid: boolean;
  ru: boolean;
  onChange: (key: InputKey, value: string) => void;
}) {
  return (
    <Field
      label={
        <>
          {field.label[ru ? 1 : 0]}
          {field.unit && <small>{field.unit[ru ? 1 : 0]}</small>}
        </>
      }
    >
      <Input
        name={field.key}
        data-field={field.key}
        value={value}
        aria-invalid={invalid || undefined}
        type="text"
        inputMode={integerFields.has(field.key) ? "numeric" : "decimal"}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    </Field>
  );
}

function Metric({
  label,
  value,
  metric,
  raw,
}: {
  label: string;
  value: string;
  metric: string;
  raw: number | undefined;
}) {
  return (
    <div className="sd-metric">
      <dt>{label}</dt>
      <dd>
        <output data-metric={metric} data-value={raw ?? ""}>
          {value}
        </output>
      </dd>
    </div>
  );
}

function Calculator() {
  const { locale } = usePlugin();
  const ru = locale === "ru";
  const t = (en: string, russian: string) => (ru ? russian : en);
  const [inputs, setInputs] = useState<Inputs>(() => ({ ...DEFAULT_INPUTS }));
  const [section, setSection] = useState<Section>("load");
  const onSectionChange = (value: string) => setSection(value as Section);
  const headerTabs = useWorkspaceHeaderTabs({
    items: sections.map((item) => ({ id: item.value, label: item.label[ru ? 1 : 0] })),
    value: section,
    onValueChange: onSectionChange,
  });
  const result = calculate(inputs);
  const number = (value: number | undefined) =>
    value === undefined ? "—" : formatNumber(value, locale);
  const bytes = (value: number | undefined) =>
    value === undefined ? "—" : formatBytes(value, locale);
  const metric = (
    key: string,
    label: string,
    value: number | undefined,
    unit: "number" | "bytes" = "number",
  ) => (
    <Metric
      metric={key}
      label={label}
      raw={value}
      value={unit === "bytes" ? bytes(value) : number(value)}
    />
  );

  const update = (key: InputKey, value: string) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
  };

  const errorKey = fields[section].find((field) => result.errors[field.key]);
  const errorsElsewhere = sections.filter(
    (item) =>
      item.value !== section && fields[item.value].some((field) => result.errors[field.key]),
  );
  const overflowElsewhere = sections.filter(
    (item) => item.value !== section && result.overflow.includes(item.value),
  );
  const error = errorKey ? result.errors[errorKey.key] : null;
  const rangeText =
    errorKey?.key === "writesPercent" || errorKey?.key === "cacheHitPercent"
      ? t("Use a value from 0 to 100.", "Введите значение от 0 до 100.")
      : errorKey?.key === "replicas" ||
          errorKey?.key === "cacheCopies" ||
          errorKey?.key === "peakMultiplier"
        ? t("Use a value of at least 1.", "Введите значение не меньше 1.")
        : t(
            "Use a nonnegative value within the supported range.",
            "Введите неотрицательное значение в допустимом диапазоне.",
          );
  const errorText =
    error === "required"
      ? t("Enter a value.", "Введите значение.")
      : error === "number"
        ? t("Enter a finite number.", "Введите конечное число.")
        : error === "integer"
          ? t("Use a whole number.", "Нужно целое число.")
          : rangeText;
  const formulas: Record<Section, string[]> = {
    load: [
      t(
        "Average RPS = DAU × requests per user ÷ 86,400",
        "Средний RPS = DAU × запросов на человека ÷ 86 400",
      ),
      t("Peak RPS = average RPS × peak multiplier", "Пиковый RPS = средний RPS × множитель пика"),
    ],
    network: [
      t(
        "Peak Mbit/s = peak RPS × size in KiB × 1024 × 8 ÷ 1,000,000",
        "Пик Мбит/с = пиковый RPS × размер в КиБ × 1024 × 8 ÷ 1 000 000",
      ),
      t(
        "Daily egress = daily requests × response KiB × 1024",
        "Исходящий за день = запросов в день × ответ в КиБ × 1024",
      ),
    ],
    storage: [
      t(
        "New records per day = daily requests × write share",
        "Новых записей в день = запросов в день × доля записей",
      ),
      t(
        "Logical bytes = new records per day × record KiB × 1024 × days",
        "Логический объём = новых записей в день × запись в КиБ × 1024 × дней",
      ),
      t(
        "Physical bytes = logical bytes × copies × (1 + overhead / 100)",
        "Физический объём = логический объём × копий × (1 + запас / 100)",
      ),
    ],
    cache: [
      t(
        "RAM per copy = keys × object KiB × 1024 × (1 + overhead / 100)",
        "RAM копии = ключей × объект в КиБ × 1024 × (1 + запас / 100)",
      ),
      t("Total RAM = RAM per copy × cache copies", "Всего RAM = RAM копии × копий кеша"),
      t(
        "Origin reads = peak RPS × read share × (1 − hit rate)",
        "Чтения в БД = пиковый RPS × доля чтений × (1 − доля попаданий)",
      ),
      t(
        "Origin total = origin reads + peak RPS × write share",
        "Всего в БД = чтения в БД + пиковый RPS × доля записей",
      ),
    ],
  };

  return (
    <section
      className="sd-calculator"
      data-section={section}
      aria-label={t("System design calculator", "Калькулятор system design")}
    >
      {!headerTabs && (
        <div className="sd-tabs">
          <Tabs
            label={t("Calculation section", "Раздел расчёта")}
            value={section}
            onValueChange={onSectionChange}
            items={sections.map((item) => ({ value: item.value, label: item.label[ru ? 1 : 0] }))}
          />
        </div>
      )}
      <dl className="sd-results" aria-label={t("Results", "Результаты")}>
        {section === "load" && (
          <>
            {metric("avgRps", t("Average RPS", "Средний RPS"), result.load?.avgRps)}
            {metric("peakRps", t("Peak RPS", "Пиковый RPS"), result.load?.peakRps)}
          </>
        )}
        {section === "network" && (
          <>
            {metric(
              "peakIngressMbps",
              t("Peak in · Mbit/s", "Пик вход · Мбит/с"),
              result.network?.peakIngressMbps,
            )}
            {metric(
              "peakEgressMbps",
              t("Peak out · Mbit/s", "Пик выход · Мбит/с"),
              result.network?.peakEgressMbps,
            )}
            {metric(
              "dailyEgressBytes",
              t("Egress per day", "Исходящий за день"),
              result.network?.dailyEgressBytes,
              "bytes",
            )}
          </>
        )}
        {section === "storage" && (
          <>
            {metric(
              "logicalBytes",
              t("Logical data", "Логические данные"),
              result.storage?.logicalBytes,
              "bytes",
            )}
            {metric(
              "physicalBytes",
              t("All copies + overhead", "Все копии + запас"),
              result.storage?.physicalBytes,
              "bytes",
            )}
            {metric(
              "writesPerDay",
              t("New records per day", "Новых записей в день"),
              result.storage?.writesPerDay,
            )}
          </>
        )}
        {section === "cache" && (
          <>
            {metric(
              "bytesPerCopy",
              t("RAM per copy", "RAM одной копии"),
              result.cache?.bytesPerCopy,
              "bytes",
            )}
            {metric(
              "totalBytes",
              t("RAM all copies", "RAM всех копий"),
              result.cache?.totalBytes,
              "bytes",
            )}
            {metric(
              "originReadRps",
              t("Origin reads · peak RPS", "Чтения в БД · пик RPS"),
              result.cache?.originReadRps,
            )}
            {metric(
              "originTotalRps",
              t("Origin total · peak RPS", "Всего в БД · пик RPS"),
              result.cache?.originTotalRps,
            )}
          </>
        )}
      </dl>
      {errorKey && (
        <p className="sd-error" role="alert">
          {errorKey.label[ru ? 1 : 0]}: {errorText}
        </p>
      )}
      {result.overflow.includes(section) && (
        <p className="sd-error" role="alert">
          {t(
            "These values exceed the calculation range. Reduce them.",
            "Значения слишком велики для расчёта. Уменьшите их.",
          )}
        </p>
      )}
      <div className="sd-fields">
        {fields[section].map((field) => (
          <Parameter
            key={field.key}
            field={field}
            value={inputs[field.key]}
            invalid={!!result.errors[field.key]}
            ru={ru}
            onChange={update}
          />
        ))}
      </div>
      {section !== "load" && (
        <p className="sd-note">
          RPS: {number(result.load?.avgRps)} / {number(result.load?.peakRps)}{" "}
          {t("avg / peak", "средний / пик")}.
        </p>
      )}
      {!!errorsElsewhere.length && (
        <p className="sd-note" role="status">
          {t("Check inputs in", "Проверьте параметры во вкладках")}
          {": "}
          {errorsElsewhere.map((item) => item.label[ru ? 1 : 0]).join(", ")}.
        </p>
      )}
      {!!overflowElsewhere.length && (
        <p className="sd-note" role="status">
          {t(
            "Results exceed the supported range in",
            "Результаты выходят за допустимый диапазон во вкладках",
          )}
          : {overflowElsewhere.map((item) => item.label[ru ? 1 : 0]).join(", ")}.
        </p>
      )}
      <div className="sd-footer">
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("Reset all", "Сбросить всё")}
          onClick={() => setInputs({ ...DEFAULT_INPUTS })}
        >
          {t("Reset", "Сбросить")}
        </Button>
        <details className="sd-assumptions">
          <summary>{t("Formulas and assumptions", "Формулы и допущения")}</summary>
          <ul>
            {formulas[section].map((formula) => (
              <li key={formula}>
                <code>{formula}</code>
              </li>
            ))}
          </ul>
          <p>
            {t(
              "1 KiB = 1024 bytes; Mbit/s uses 1,000,000 bits. A day is 86,400 seconds. Peak load changes bandwidth, not daily storage. Convert percentages to shares by dividing by 100.",
              "1 КиБ = 1024 байта; Мбит/с = 1 000 000 бит/с. В сутках 86 400 секунд. Пик меняет трафик, но не суточный объём данных. Доли равны процентам, делённым на 100.",
            )}
          </p>
          <p>
            {t(
              "Every write adds a retained record. No compression or deduplication. Copy counts include the primary. Cache hits reduce reads only; writes still reach the origin.",
              "Каждая запись добавляет сохраняемые данные. Без сжатия и дедупликации. Число копий включает основную. Кеш уменьшает только чтения; записи идут в БД.",
            )}
          </p>
          <p>
            {t(
              "Inputs stay while this overlay view is mounted; they are not saved between sessions.",
              "Параметры сохраняются, пока панель смонтирована; между сессиями они не записываются.",
            )}
          </p>
        </details>
      </div>
    </section>
  );
}

renderPlugin({ calculator: Calculator });
