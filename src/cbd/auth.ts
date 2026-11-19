import { SignJWT } from "jose";
import type { CbdConfig } from "../config.js";

const encoder = new TextEncoder();

export async function createAccessToken(config: CbdConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const secret = encoder.encode(config.keySecret);

  return new SignJWT({
    iss: config.appName,
    cid: config.clientId,
    appver: config.appVersion,
    aud: "business-dashboard.cisco.com",
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
      kid: config.keyId,
    })
    .setIssuedAt(now)
    .setExpirationTime(now + config.jwtLifetimeSeconds)
    .sign(secret);
}
