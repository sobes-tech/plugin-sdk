import { describe, expect, it } from "bun:test";
import {
  calculate,
  DEFAULT_INPUTS,
  formatBytes,
  formatNumber,
  parseInputs,
  parseNumber,
  type Inputs,
} from "./model";

const example: Inputs = {
  dau: "86400",
  requestsPerUser: "10",
  peakMultiplier: "5",
  requestKiB: "1",
  responseKiB: "2",
  writesPercent: "25",
  recordKiB: "1",
  retentionDays: "10",
  replicas: "3",
  storageOverheadPercent: "20",
  hotKeys: "1000",
  cacheObjectKiB: "2",
  cacheOverheadPercent: "25",
  cacheHitPercent: "90",
  cacheCopies: "2",
};

describe("System design arithmetic", () => {
  it("uses explicit day, KiB, bit-rate and copy units in a hand-calculated scenario", () => {
    const result = calculate(example);

    expect(result.errors).toEqual({});
    expect(result.overflow).toEqual([]);
    expect(result.load).toEqual({ dailyRequests: 864000, avgRps: 10, peakRps: 50 });
    expect(result.network!.peakIngressMbps).toBeCloseTo(0.4096, 10);
    expect(result.network!.peakEgressMbps).toBeCloseTo(0.8192, 10);
    expect(result.network!.dailyIngressBytes).toBe(884736000);
    expect(result.network!.dailyEgressBytes).toBe(1769472000);
    expect(result.storage).toEqual({
      writesPerDay: 216000,
      logicalBytes: 2211840000,
      physicalBytes: 7962624000,
    });

    expect(result.cache!.bytesPerCopy).toBe(2560000);
    expect(result.cache!.totalBytes).toBe(5120000);
    expect(result.cache!.originReadRps).toBeCloseTo(3.75, 10);
    expect(result.cache!.originWriteRps).toBe(12.5);
    expect(result.cache!.originTotalRps).toBeCloseTo(16.25, 10);
  });

  it("does not multiply average storage growth by the peak factor", () => {
    const normal = calculate({ ...example, peakMultiplier: "1" });
    const spiky = calculate({ ...example, peakMultiplier: "100" });

    expect(spiky.storage).toEqual(normal.storage);
    expect(spiky.network!.dailyEgressBytes).toBe(normal.network!.dailyEgressBytes);
    expect(spiky.load!.peakRps).toBe(normal.load!.peakRps * 100);
  });

  it("includes the primary in copy counts and permits overhead greater than the base data", () => {
    const result = calculate({
      ...example,
      replicas: "1",
      cacheCopies: "1",
      storageOverheadPercent: "150",
      cacheOverheadPercent: "200",
    });

    expect(result.errors).toEqual({});
    expect(result.storage!.physicalBytes).toBe(result.storage!.logicalBytes * 2.5);
    expect(result.cache!.totalBytes).toBe(result.cache!.bytesPerCopy);
    expect(result.cache!.bytesPerCopy).toBe(1000 * 2 * 1024 * 3);
  });

  it("reduces only origin reads with cache hits and preserves writes", () => {
    const missed = calculate({ ...example, cacheHitPercent: "0" });
    const hit = calculate({ ...example, cacheHitPercent: "100" });

    expect(missed.cache!.originReadRps).toBe(37.5);
    expect(hit.cache!.originReadRps).toBe(0);
    expect(hit.cache!.originWriteRps).toBe(12.5);
    expect(hit.cache!.originTotalRps).toBe(12.5);
    const onlyWrites = calculate({ ...example, writesPercent: "100", cacheHitPercent: "100" });

    expect(onlyWrites.cache!.originTotalRps).toBe(50);
  });

  it("handles zero workloads and zero retention without Infinity times zero", () => {
    const idle = calculate({
      ...example,
      dau: "0",
      requestsPerUser: "1e308",
      peakMultiplier: "1e308",
      requestKiB: "1e308",
      responseKiB: "1e308",
      recordKiB: "1e308",
      retentionDays: "1e308",
      hotKeys: "0",
      cacheObjectKiB: "1e308",
      cacheOverheadPercent: "1e308",
    });

    expect(idle.errors).toEqual({});
    expect(idle.overflow).toEqual([]);
    expect(idle.load).toEqual({ dailyRequests: 0, avgRps: 0, peakRps: 0 });
    expect(idle.storage).toEqual({ writesPerDay: 0, logicalBytes: 0, physicalBytes: 0 });
    expect(idle.cache!.totalBytes).toBe(0);
    const noRetention = calculate({ ...example, retentionDays: "0" });

    expect(noRetention.storage!.writesPerDay).toBe(216000);
    expect(noRetention.storage!.physicalBytes).toBe(0);
  });

  it("suppresses affected results for invalid fields and reports overflow rather than nonfinite numbers", () => {
    const bad = calculate({
      ...example,
      responseKiB: "",
      cacheCopies: "1.5",
      writesPercent: "101",
    });

    expect(bad.load).not.toBeNull();
    expect(bad.network).toBeNull();
    expect(bad.storage).toBeNull();
    expect(bad.cache).toBeNull();
    expect(bad.errors).toEqual({
      responseKiB: "required",
      writesPercent: "range",
      cacheCopies: "integer",
    });

    const huge = calculate({ ...example, requestsPerUser: "1e308" });

    expect(huge.errors).toEqual({});
    expect(huge.load).toBeNull();
    expect(huge.network).toBeNull();
    expect(huge.storage).toBeNull();
    expect(huge.cache).toBeNull();
    expect(huge.overflow).toEqual(["load", "network", "storage", "cache"]);
  });
});

describe("Numeric input and presentation", () => {
  it("accepts decimal commas, proper space grouping and scientific notation without guessing separators", () => {
    for (const [raw, expected] of [
      [" 1 000,5 ", 1000.5],
      ["1\u00a0000\u202f000", 1000000],
      ["1e6", 1000000],
      [",5", 0.5],
      [".5e+2", 50],
      ["1.", 1],
      ["0e999", 0],
    ] as const) {
      expect(parseNumber(raw)).toBe(expected);
    }

    for (const raw of [
      "",
      " ",
      "1,000.5",
      "1.000,5",
      "1 00",
      "1 2",
      "1e",
      "1e999",
      "1e-999",
      "NaN",
      "Infinity",
      "0x10",
      "10%",
      "1/2",
    ]) {
      expect(parseNumber(raw)).toBeNull();
    }
  });

  it("validates counts, ratios and fractions for their specific fields", () => {
    expect(
      parseInputs({
        ...DEFAULT_INPUTS,
        dau: "-1",
        hotKeys: "1.1",
        replicas: "0",
        cacheCopies: "9007199254740992",
        peakMultiplier: "0.9",
      }).errors,
    ).toEqual({
      dau: "range",
      peakMultiplier: "range",
      replicas: "range",
      hotKeys: "integer",
      cacheCopies: "range",
    });

    expect(
      parseInputs({ ...DEFAULT_INPUTS, requestsPerUser: "0,5", retentionDays: "1.5" }).errors,
    ).toEqual({});

    expect(
      parseInputs({ ...DEFAULT_INPUTS, cacheHitPercent: "100.1" }).errors.cacheHitPercent,
    ).toBe("range");
  });

  it("formats IEC sizes and rounded numbers without emitting nonfinite values", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(1024, "ru")).toBe("1 KiB");
    expect(formatBytes(3 * 1024 ** 3, "en")).toBe("3 GiB");
    expect(formatNumber(12.5, "ru")).toBe("12,5");
    expect(formatNumber(-0, "en")).toBe("0");
    expect(formatNumber(Infinity, "en")).toBe("—");
    expect(formatBytes(NaN, "en")).toBe("—");
    expect(formatNumber(1e100, "en").length).toBeLessThan(12);
  });
});
