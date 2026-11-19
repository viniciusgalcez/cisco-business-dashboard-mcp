import { CbdApiError } from "../cbd/client.js";

export function jsonResult(data: unknown, meta?: Record<string, unknown>) {
  const payload = meta === undefined ? data : { meta, data };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function errorResult(error: unknown) {
  if (error instanceof CbdApiError) {
    return {
      isError: true as const,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: "cbd_api_error",
              status: error.status,
              message: error.message,
              body: safeJson(error.body),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: "mcp_error", message }, null, 2),
      },
    ],
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function getNested(
  record: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
