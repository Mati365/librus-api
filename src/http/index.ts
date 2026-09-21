import fetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";

import { LibrusApiError, LibrusAuthError } from "../errors/index.js";
import type { FetchLike, QueryParams } from "../types/index.js";
import { headersToObject } from "./headers.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface HttpClient {
  fetch: FetchLike;
  getJson: (path: string, query?: QueryParams) => Promise<unknown>;
  timeoutMs: number;
  synergiaBaseUrl: string;
  authBaseUrl: string;
}

export function createHttpClient(options: {
  fetch?: FetchLike;
  timeoutMs?: number;
  synergiaBaseUrl?: string;
  authBaseUrl?: string;
}): HttpClient {
  const jar = new CookieJar();
  const cookieFetch = fetchCookie(options.fetch ?? globalThis.fetch, jar);
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const synergiaBaseUrl =
    options.synergiaBaseUrl ?? "https://synergia.librus.pl";
  const authBaseUrl = options.authBaseUrl ?? "https://api.librus.pl";
  const apiBaseUrl = `${synergiaBaseUrl.replace(/\/$/, "")}/gateway/api/2.0`;

  const fetchWithTimeout: FetchLike = async (input, init = {}) => {
    const signal = mergeSignals(init.signal, AbortSignal.timeout(timeoutMs));
    return cookieFetch(input, {
      ...init,
      signal,
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        ...headersToObject(init.headers),
      },
    });
  };

  return {
    fetch: fetchWithTimeout,
    timeoutMs,
    synergiaBaseUrl,
    authBaseUrl,
    async getJson(path: string, query?: QueryParams): Promise<unknown> {
      const endpoint = buildApiUrl(apiBaseUrl, path, query);
      const response = await fetchWithTimeout(endpoint, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (response.status === 401 || response.status === 403) {
        throw new LibrusAuthError(
          `Librus API rejected ${endpoint} with HTTP ${response.status}.`
        );
      }

      if (!response.ok) {
        throw new LibrusApiError(
          `Librus API request failed with HTTP ${response.status}.`,
          response.status,
          endpoint
        );
      }

      return (await response.json()) as unknown;
    },
  };
}

export function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs == null) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.min(timeoutMs, 120_000);
}

function mergeSignals(
  userSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal
): AbortSignal {
  if (!userSignal) {
    return timeoutSignal;
  }
  return AbortSignal.any([userSignal, timeoutSignal]);
}

function buildApiUrl(
  apiBaseUrl: string,
  path: string,
  query?: QueryParams
): string {
  const url = new URL(
    path.replace(/^\/+/, ""),
    `${apiBaseUrl.replace(/\/$/, "")}/`
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}
