/**
 * Typed API client wrapping fetch with auth injection, timeout, and
 * 401 interception for automatic token refresh.
 */

import { CENTRAL_API_URL, DEFAULT_TIMEOUT_MS, DEVICE_API_URL } from "@/constants/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard error shape returned by nomothetic. */
export interface ApiError {
  success: false;
  error: string;
  timestamp: string;
}

/** Options for a single API call. */
interface RequestOptions {
  /** HTTP method (default: GET). */
  method?: string;
  /** JSON body (automatically serialised). */
  body?: unknown;
  /** Extra headers merged with defaults. */
  headers?: Record<string, string>;
  /** Per-request timeout in ms (overrides default). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Token access — set by AuthProvider at runtime
// ---------------------------------------------------------------------------

let _getAccessToken: (() => string | null) | null = null;
let _onUnauthorised: (() => Promise<boolean>) | null = null;
let _isRefreshing = false;

let _getDeviceAccessToken: (() => string | null) | null = null;
let _onDeviceUnauthorised: (() => Promise<boolean>) | null = null;
let _isDeviceRefreshing = false;

/**
 * Called by AuthProvider to wire central token access into the API client.
 */
export function setTokenAccessors(
  getToken: () => string | null,
  onUnauthorised: () => Promise<boolean>,
): void {
  _getAccessToken = getToken;
  _onUnauthorised = onUnauthorised;
}

/**
 * Called by AuthProvider to wire device token access into the API client.
 */
export function setDeviceTokenAccessors(
  getToken: () => string | null,
  onUnauthorised: () => Promise<boolean>,
): void {
  _getDeviceAccessToken = getToken;
  _onDeviceUnauthorised = onUnauthorised;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function rawFetch<T>(
  baseUrl: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Inject auth token: device token for device API, central token otherwise
  const isDeviceRequest = baseUrl === DEVICE_API_URL;
  const tokenGetter = isDeviceRequest ? _getDeviceAccessToken : _getAccessToken;
  const token = tokenGetter?.();
  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      const refreshing = isDeviceRequest ? _isDeviceRefreshing : _isRefreshing;
      const onUnauth = isDeviceRequest ? _onDeviceUnauthorised : _onUnauthorised;

      if (onUnauth && !refreshing) {
        if (isDeviceRequest) {
          _isDeviceRefreshing = true;
        } else {
          _isRefreshing = true;
        }
        try {
          const refreshed = await onUnauth();
          if (refreshed) {
            return rawFetch<T>(baseUrl, path, opts);
          }
        } finally {
          if (isDeviceRequest) {
            _isDeviceRefreshing = false;
          } else {
            _isRefreshing = false;
          }
        }
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: response.statusText,
        timestamp: new Date().toISOString(),
      }));
      throw new ApiRequestError(
        errorBody.error || response.statusText,
        response.status,
        errorBody,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiRequestError("Request timed out", 0);
    }
    throw new ApiRequestError(
      (err as Error).message || "Network error",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Error thrown by the API client. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Make a request to the device-mode API (Pi).
 */
export async function deviceApi<T>(
  path: string,
  opts?: RequestOptions,
): Promise<T> {
  return rawFetch<T>(DEVICE_API_URL, path, opts);
}

/**
 * Make a request to the central-mode API (fleet server).
 */
export async function centralApi<T>(
  path: string,
  opts?: RequestOptions,
): Promise<T> {
  return rawFetch<T>(CENTRAL_API_URL, path, opts);
}
