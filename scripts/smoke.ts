import { decodeProtectedHeader, jwtVerify } from "jose";
import { createAccessToken } from "../src/cbd/auth.js";
import type { CbdConfig } from "../src/config.js";

async function main() {
  const config: CbdConfig = {
    baseUrl: "https://cisco.capricornio.corp.br",
    keyId: "smoke-key-id",
    keySecret: "smoke-key-secret-value",
    tlsInsecure: true,
    appName: "cisco-business-dashboard-mcp.smoke",
    appVersion: "1.0.0",
    clientId: "00000000-0000-4000-8000-000000000001",
    jwtLifetimeSeconds: 3600,
  };

  const token = await createAccessToken(config);
  const header = decodeProtectedHeader(token);

  if (header.alg !== "HS256") {
    throw new Error(`Expected HS256, got ${header.alg}`);
  }
  if (header.kid !== config.keyId) {
    throw new Error(`Expected kid ${config.keyId}, got ${header.kid}`);
  }

  const verified = await jwtVerify(
    token,
    new TextEncoder().encode(config.keySecret),
    {
      audience: "business-dashboard.cisco.com",
      algorithms: ["HS256"],
    },
  );

  const claims = verified.payload;
  if (claims.iss !== config.appName) {
    throw new Error("Unexpected iss claim");
  }
  if (claims.cid !== config.clientId) {
    throw new Error("Unexpected cid claim");
  }
  if (claims.appver !== config.appVersion) {
    throw new Error("Unexpected appver claim");
  }

  console.log("smoke ok");
  console.log(
    JSON.stringify(
      {
        header,
        claims: {
          iss: claims.iss,
          cid: claims.cid,
          appver: claims.appver,
          aud: claims.aud,
          iat: claims.iat,
          exp: claims.exp,
        },
        token_preview: `${token.slice(0, 24)}…`,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("smoke failed:", error);
  process.exit(1);
});
