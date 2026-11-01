import type { ErrorCode, PublicError } from "./types";

const codes = new Set<ErrorCode>([
  "unsupported_api_version",
  "unsupported_feature",
  "unsupported_transport",
  "invalid_argument",
  "invalid_host_response",
  "permission_denied",
  "permission_revoked",
  "scope_denied",
  "resource_not_found",
  "revision_conflict",
  "idempotency_conflict",
  "rate_limited",
  "quota_exceeded",
  "stream_gap",
  "stream_closed",
  "buffer_overflow",
  "cancelled",
  "host_unavailable",
]);

export class PluginApiError extends Error {
  readonly code: ErrorCode;

  readonly retryable: boolean;

  readonly retryAfterMs?: number;

  readonly details?: PublicError["details"];

  constructor(error: PublicError) {
    super(error.message ?? error.code);
    this.name = "PluginApiError";
    this.code = error.code;
    this.retryable = error.retryable;
    this.retryAfterMs = error.retryAfterMs;
    this.details = error.details;
  }
}

export function pluginApiError(code: ErrorCode, message?: string): PluginApiError {
  return new PluginApiError({ code, message, retryable: false });
}

export function normalizePluginApiError(error: unknown): PluginApiError {
  if (error instanceof PluginApiError) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    codes.has(error.code as ErrorCode)
  ) {
    const data = error as PublicError;

    return new PluginApiError({
      ...data,
      retryable: data.retryable === true,
      retryAfterMs:
        typeof data.retryAfterMs === "number" &&
        Number.isFinite(data.retryAfterMs) &&
        data.retryAfterMs >= 0
          ? data.retryAfterMs
          : undefined,
    });
  }

  return pluginApiError("host_unavailable");
}
