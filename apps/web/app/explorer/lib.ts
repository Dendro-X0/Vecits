import { NodeApiError } from "@new-start/sdk-ts";

export type QueryParams = Record<string, string | string[] | undefined>;
const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const DEFAULT_NODE_BASE_URL = "http://127.0.0.1:7878";

export function getSingleParam(query: QueryParams, key: string): string {
  const value = query[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function getOptionalParam(query: QueryParams, key: string): string | undefined {
  const value = getSingleParam(query, key).trim();
  return value.length > 0 ? value : undefined;
}

export function hasParam(query: QueryParams, key: string): boolean {
  return key in query;
}

export function buildExplorerHref(
  path: string,
  query: QueryParams,
  patch: Record<string, string | undefined | null>
): string {
  const params = new URLSearchParams();

  const scopedBaseUrl = getOptionalParam(query, "base_url");
  const scopedAsOf = getOptionalParam(query, "as_of");
  if (scopedBaseUrl) {
    params.set("base_url", scopedBaseUrl);
  }
  if (scopedAsOf) {
    params.set("as_of", scopedAsOf);
  }

  for (const [key, value] of Object.entries(patch)) {
    const normalized = value?.trim();
    if (!normalized) {
      params.delete(key);
    } else {
      params.set(key, normalized);
    }
  }

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export function getNodeBaseUrl(query: QueryParams): string {
  const baseFromQuery = getOptionalParam(query, "base_url");
  if (baseFromQuery && !validateBaseUrl(baseFromQuery)) {
    return baseFromQuery;
  }
  return (
    process.env.NODE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_NODE_API_BASE_URL ??
    DEFAULT_NODE_BASE_URL
  );
}

export function validateBaseUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Invalid base_url: expected http:// or https://";
    }
    return null;
  } catch {
    return "Invalid base_url: expected a valid absolute URL";
  }
}

export function validateAsOf(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!RFC3339_REGEX.test(value)) {
    return "Invalid as_of: expected RFC3339, e.g. 2026-03-01T00:00:00Z";
  }

  return null;
}

export function parseOptionalInt(
  raw: string,
  fieldName: string,
  min: number
): { value: number | undefined; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined, error: null };
  }

  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value) || value < min) {
    return {
      value: undefined,
      error: `Invalid ${fieldName}: expected integer >= ${min}`
    };
  }

  return { value, error: null };
}

export function parseOptionalSignedInt(
  raw: string,
  fieldName: string
): { value: number | undefined; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined, error: null };
  }

  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value)) {
    return {
      value: undefined,
      error: `Invalid ${fieldName}: expected integer`
    };
  }

  return { value, error: null };
}

export function parseOptionalBooleanFlag(
  raw: string,
  fieldName: string
): { value: boolean | undefined; error: string | null } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { value: undefined, error: null };
  }
  if (trimmed === "1" || trimmed === "true" || trimmed === "yes" || trimmed === "on") {
    return { value: true, error: null };
  }
  if (trimmed === "0" || trimmed === "false" || trimmed === "no" || trimmed === "off") {
    return { value: false, error: null };
  }
  return {
    value: undefined,
    error: `Invalid ${fieldName}: expected one of 1,true,yes,on,0,false,no,off`
  };
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof NodeApiError) {
    return `${error.message} (status ${error.status})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown error";
}
