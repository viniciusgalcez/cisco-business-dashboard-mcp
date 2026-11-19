import { randomUUID } from "node:crypto";

export type CbdConfig = {
  baseUrl: string;
  keyId: string;
  keySecret: string;
  orgId?: string;
  tlsInsecure: boolean;
  appName: string;
  appVersion: string;
  clientId: string;
  jwtLifetimeSeconds: number;
};

export function loadConfig(): CbdConfig {
  const baseUrl = (
    process.env.CBD_BASE_URL ||
    process.env.CISCO_CBD_URL ||
    "https://cisco.capricornio.corp.br"
  )
    .trim()
    .replace(/\/$/, "");

  const keyId =
    process.env.CBD_KEY_ID?.trim() || process.env.CBD_ACCESS_KEY_ID?.trim();
  const keySecret =
    process.env.CBD_KEY_SECRET?.trim() ||
    process.env.CBD_ACCESS_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error(
      "Missing CBD_KEY_ID / CBD_KEY_SECRET. Create an access key in Cisco Business Dashboard → Administration → Users.",
    );
  }

  const tlsInsecure = ["1", "true", "yes", "on"].includes(
    (process.env.CBD_TLS_INSECURE || "").trim().toLowerCase(),
  );

  const lifetimeRaw = Number(process.env.CBD_JWT_LIFETIME_SECONDS || "3600");
  const jwtLifetimeSeconds =
    Number.isFinite(lifetimeRaw) && lifetimeRaw > 60 ? lifetimeRaw : 3600;

  return {
    baseUrl,
    keyId,
    keySecret,
    orgId: process.env.CBD_ORG_ID?.trim() || undefined,
    tlsInsecure,
    appName:
      process.env.CBD_APP_NAME?.trim() ||
      "cisco-business-dashboard-mcp.local",
    appVersion: process.env.CBD_APP_VERSION?.trim() || "1.0.0",
    clientId: process.env.CBD_CLIENT_ID?.trim() || randomUUID(),
    jwtLifetimeSeconds,
  };
}
