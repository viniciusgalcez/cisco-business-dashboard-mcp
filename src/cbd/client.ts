import { createAccessToken } from "./auth.js";
import type { CbdConfig } from "../config.js";

export class CbdApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, path: string) {
    super(`Cisco Business Dashboard API ${status} on ${path}: ${body}`);
    this.name = "CbdApiError";
    this.status = status;
    this.body = body;
  }
}

type QueryValue = string | number | boolean | undefined | null;
type Query = Record<string, QueryValue | QueryValue[]>;

export class CbdClient {
  private readonly config: CbdConfig;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: CbdConfig) {
    this.config = config;
    if (config.tlsInsecure && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      console.error(
        "[cbd-mcp] CBD_TLS_INSECURE=true — TLS certificate verification is disabled.",
      );
    }
  }

  async get<T = unknown>(
    path: string,
    query?: Query,
    orgId?: string,
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, query, orgId);
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    query?: Query,
    orgId?: string,
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "cisco-business-dashboard-mcp/1.0",
    };

    const org = orgId?.trim() || this.config.orgId;
    if (org) {
      headers["x-ctx-org-id"] = org;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetchWithRetry(url, init);
    const text = await response.text();

    if (!response.ok) {
      throw new CbdApiError(response.status, text.slice(0, 2000), path);
    }

    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  private async getToken(): Promise<string> {
    const skewSeconds = 60;
    const now = Math.floor(Date.now() / 1000);
    if (this.token && now < this.tokenExpiresAt - skewSeconds) {
      return this.token;
    }

    this.token = await createAccessToken(this.config);
    this.tokenExpiresAt = now + this.config.jwtLifetimeSeconds;
    return this.token;
  }

  private buildUrl(path: string, query?: Query): string {
    const normalized = path.startsWith("http")
      ? path
      : `${this.config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const url = new URL(normalized);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item === undefined || item === null || item === "") continue;
            url.searchParams.append(key, String(item));
          }
          continue;
        }
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }
}

export function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;
  for (const key of ["data", "content", "items", "nodes", "networks", "orgs"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 || attempt === attempts - 1) {
        return response;
      }
      await sleep(1000 * (attempt + 1));
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Cisco Business Dashboard request failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
