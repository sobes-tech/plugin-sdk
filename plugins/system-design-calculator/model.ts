export const INPUT_KEYS = [
  "dau",
  "requestsPerUser",
  "peakMultiplier",
  "requestKiB",
  "responseKiB",
  "writesPercent",
  "recordKiB",
  "retentionDays",
  "replicas",
  "storageOverheadPercent",
  "hotKeys",
  "cacheObjectKiB",
  "cacheOverheadPercent",
  "cacheHitPercent",
  "cacheCopies",
] as const;

export type InputKey = (typeof INPUT_KEYS)[number];

export type Inputs = Record<InputKey, string>;

export type NumericInputs = Record<InputKey, number>;

export type Section = "load" | "network" | "storage" | "cache";

export type InputError = "required" | "number" | "range" | "integer";

interface FieldRule {
  min: number;
  max?: number;
  integer?: boolean;
}

export const FIELD_RULES: Record<InputKey, FieldRule> = {
  dau: { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true },
  requestsPerUser: { min: 0 },
  peakMultiplier: { min: 1 },
  requestKiB: { min: 0 },
  responseKiB: { min: 0 },
  writesPercent: { min: 0, max: 100 },
  recordKiB: { min: 0 },
  retentionDays: { min: 0 },
  replicas: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true },
  storageOverheadPercent: { min: 0 },
  hotKeys: { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true },
  cacheObjectKiB: { min: 0 },
  cacheOverheadPercent: { min: 0 },
  cacheHitPercent: { min: 0, max: 100 },
  cacheCopies: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true },
};

export const DEFAULT_INPUTS: Inputs = {
  dau: "1000000",
  requestsPerUser: "20",
  peakMultiplier: "5",
  requestKiB: "1",
  responseKiB: "4",
  writesPercent: "10",
  recordKiB: "1",
  retentionDays: "365",
  replicas: "3",
  storageOverheadPercent: "20",
  hotKeys: "100000",
  cacheObjectKiB: "2",
  cacheOverheadPercent: "20",
  cacheHitPercent: "95",
  cacheCopies: "2",
};

/** Accept decimal dot/comma, scientific notation and unambiguous groups of three digits. */
export function parseNumber(raw: string): number | null {
  const text = raw.trim();

  if (!text || text.length > 100) {
    return null;
  }

  if (
    !/^[+-]?(?:(?:\d{1,3}(?:[ \u00a0\u202f]+\d{3})+|\d+)(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(
      text,
    )
  ) {
    return null;
  }

  const value = Number(text.replace(/[ \u00a0\u202f]/g, "").replace(",", "."));
  // Do not silently turn a nonzero scientific value into zero on underflow.
  const nonzeroMantissa = /[1-9]/.test(text.split(/[eE]/, 1)[0]);

  return Number.isFinite(value) && !(value === 0 && nonzeroMantissa) ? value : null;
}

export function parseInputs(raw: Inputs): {
  values: Partial<NumericInputs>;
  errors: Partial<Record<InputKey, InputError>>;
} {
  const values: Partial<NumericInputs> = {};
  const errors: Partial<Record<InputKey, InputError>> = {};

  for (const key of INPUT_KEYS) {
    const value = parseNumber(raw[key]);
    const rule = FIELD_RULES[key];

    if (!raw[key].trim()) {
      errors[key] = "required";
    } else if (value === null) {
      errors[key] = "number";
    } else if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
      errors[key] = "range";
    } else if (rule.integer && !Number.isInteger(value)) {
      errors[key] = "integer";
    } else {
      values[key] = value;
    }
  }

  return { values, errors };
}

export interface LoadResult {
  dailyRequests: number;
  avgRps: number;
  peakRps: number;
}

export interface NetworkResult {
  peakIngressMbps: number;
  peakEgressMbps: number;
  dailyIngressBytes: number;
  dailyEgressBytes: number;
}

export interface StorageResult {
  writesPerDay: number;
  logicalBytes: number;
  physicalBytes: number;
}

export interface CacheResult {
  bytesPerCopy: number;
  totalBytes: number;
  originReadRps: number;
  originWriteRps: number;
  originTotalRps: number;
}

export interface Calculation {
  errors: Partial<Record<InputKey, InputError>>;
  overflow: Section[];
  load: LoadResult | null;
  network: NetworkResult | null;
  storage: StorageResult | null;
  cache: CacheResult | null;
}

// Test zero before multiplying: a zero-sized workload remains zero even when
// a later conversion factor alone would overflow a floating-point number.
function product(...values: number[]): number {
  return values.includes(0) ? 0 : values.reduce((result, value) => result * value, 1);
}

function checked<T extends object>(section: Section, value: T, overflow: Section[]): T | null {
  if (
    Object.values(value).every(
      (item) => typeof item === "number" && Number.isFinite(item) && item >= 0,
    )
  ) {
    return value;
  }

  overflow.push(section);

  return null;
}

export function calculate(raw: Inputs): Calculation {
  const { values, errors } = parseInputs(raw);
  const overflow: Section[] = [];
  const has = (...keys: InputKey[]) => keys.every((key) => values[key] !== undefined);
  const input = (key: InputKey) => values[key]!;
  const daily = product(input("dau"), input("requestsPerUser"));
  const average = daily / 86400;
  const peak = product(average, input("peakMultiplier"));
  const load = has("dau", "requestsPerUser", "peakMultiplier")
    ? checked("load", { dailyRequests: daily, avgRps: average, peakRps: peak }, overflow)
    : null;
  const network = has("dau", "requestsPerUser", "peakMultiplier", "requestKiB", "responseKiB")
    ? checked(
        "network",
        {
          peakIngressMbps: product((1024 * 8) / 1_000_000, peak, input("requestKiB")),
          peakEgressMbps: product((1024 * 8) / 1_000_000, peak, input("responseKiB")),
          dailyIngressBytes: product(daily, input("requestKiB"), 1024),
          dailyEgressBytes: product(daily, input("responseKiB"), 1024),
        },
        overflow,
      )
    : null;
  const writesPerDay = product(daily, input("writesPercent") / 100);
  const logicalBytes = product(writesPerDay, input("recordKiB"), 1024, input("retentionDays"));
  const storage = has(
    "dau",
    "requestsPerUser",
    "writesPercent",
    "recordKiB",
    "retentionDays",
    "replicas",
    "storageOverheadPercent",
  )
    ? checked(
        "storage",
        {
          writesPerDay,
          logicalBytes,
          physicalBytes: product(
            logicalBytes,
            input("replicas"),
            1 + input("storageOverheadPercent") / 100,
          ),
        },
        overflow,
      )
    : null;
  const bytesPerCopy = product(
    input("hotKeys"),
    input("cacheObjectKiB"),
    1024,
    1 + input("cacheOverheadPercent") / 100,
  );
  const originReadRps = product(
    peak,
    1 - input("writesPercent") / 100,
    1 - input("cacheHitPercent") / 100,
  );
  const originWriteRps = product(peak, input("writesPercent") / 100);
  const cache = has(
    "dau",
    "requestsPerUser",
    "peakMultiplier",
    "writesPercent",
    "hotKeys",
    "cacheObjectKiB",
    "cacheOverheadPercent",
    "cacheHitPercent",
    "cacheCopies",
  )
    ? checked(
        "cache",
        {
          bytesPerCopy,
          totalBytes: product(bytesPerCopy, input("cacheCopies")),
          originReadRps,
          originWriteRps,
          originTotalRps: originReadRps + originWriteRps,
        },
        overflow,
      )
    : null;

  return { errors, overflow, load, network, storage, cache };
}

export function formatNumber(value: number, locale: string): string {
  if (!Number.isFinite(value) || value < 0) {
    return "—";
  }

  const scientific = value >= 1e12 || (value > 0 && value < 0.01);

  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumSignificantDigits: 4,
    notation: scientific ? "scientific" : "standard",
  }).format(Object.is(value, -0) ? 0 : value);
}

export function formatBytes(value: number, locale: string): string {
  if (!Number.isFinite(value) || value < 0) {
    return "—";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
  const index =
    value > 0 ? Math.min(units.length - 1, Math.max(0, Math.floor(Math.log2(value) / 10))) : 0;

  return `${formatNumber(value / 1024 ** index, locale)} ${units[index]}`;
}
