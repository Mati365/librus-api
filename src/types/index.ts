export type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface LibrusCredentials {
  login: string;
  password: string;
}

export interface LibrusClientOptions {
  fetch?: FetchLike;
  /** Request timeout in milliseconds. Defaults to 30_000. */
  timeoutMs?: number;
  authBaseUrl?: string;
  synergiaBaseUrl?: string;
}

export interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

export type { AccountInfo, LuckyNumber } from "./info.js";
