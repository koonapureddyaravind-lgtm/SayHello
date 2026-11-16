import type { ApiEnvelope, ApiError } from "./types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code = "REQUEST_FAILED", status = 500, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  raw?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function backendPath(path: string): string {
  return path.startsWith("/api/backend") ? path : `/api/backend${path.startsWith("/") ? path : `/${path}`}`;
}

/** Client-side call. Goes through the same-origin proxy that injects auth cookies. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, raw, query, headers, ...rest } = options;
  const response = await fetch(`${backendPath(path)}${buildQuery(query)}`, {
    ...rest,
    headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store"
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (raw) {
    if (!response.ok) {
      throw new ApiClientError(`Request failed with status ${response.status}`, "REQUEST_FAILED", response.status);
    }
    return (await response.text()) as T;
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      throw new ApiClientError(text || `Request failed with status ${response.status}`, "REQUEST_FAILED", response.status);
    }
    return text as T;
  }

  const json = (await response.json()) as ApiEnvelope<T> | ApiError;
  if (!response.ok || (typeof json === "object" && json !== null && "success" in json && !json.success)) {
    const envelope = json as ApiEnvelope<T>;
    const error = (envelope.error ?? (json as ApiError)) as ApiError;
    throw new ApiClientError(
      error?.message || `Request failed with status ${response.status}`,
      error?.code || "REQUEST_FAILED",
      response.status,
      error?.details
    );
  }

  return (json as ApiEnvelope<T>).data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}
