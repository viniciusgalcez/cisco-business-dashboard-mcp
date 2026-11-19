import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CbdClient, extractCollection } from "../cbd/client.js";
import {
  asRecord,
  errorResult,
  getNested,
  jsonResult,
} from "./helpers.js";

const orgIdSchema = z
  .string()
  .optional()
  .describe("Organization ID for x-ctx-org-id. Defaults to CBD_ORG_ID or all orgs.");

const pageSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Zero-based page index.");

const sizeSchema = z
  .number()
  .int()
  .min(1)
  .max(500)
  .default(50)
  .describe("Page size.");

const deviceTypeSchema = z
  .enum([
    "All",
    "Device",
    "Others",
    "Router",
    "Switch",
    "WAP",
    "IpPhone",
    "IpCamera",
    "NAS",
    "VirtualDevice",
    "WLC",
    "Host",
  ])
  .describe(
    "Node type filter. Device = Router+Switch+WAP. Host = endpoints. Defaults vary by tool.",
  );

export function registerTools(server: McpServer, client: CbdClient) {
  server.registerTool(
    "test_connection",
    {
      title: "Test CBD connection",
      description:
        "Validate JWT authentication against Cisco Business Dashboard by listing organizations.",
      inputSchema: {
        org_id: orgIdSchema,
      },
    },
    async ({ org_id }) => {
      try {
        const orgs = await client.get("/api/v2/orgs", undefined, org_id);
        const items = extractCollection(orgs);
        return jsonResult({
          ok: true,
          organization_count: items.length,
          organizations: items,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_organizations",
    {
      title: "List organizations",
      description:
        "List organizations available in Cisco Business Dashboard (GET /api/v2/orgs).",
      inputSchema: {},
    },
    async () => {
      try {
        const payload = await client.get("/api/v2/orgs");
        return jsonResult(payload, {
          count: extractCollection(payload).length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_networks",
    {
      title: "List networks",
      description:
        "List sites/networks from Cisco Business Dashboard (GET /api/v2/networks).",
      inputSchema: {
        org_id: orgIdSchema,
        search: z
          .string()
          .optional()
          .describe("Optional search string to filter networks."),
        fields: z
          .string()
          .optional()
          .describe("Comma-separated fields, e.g. name,network-id"),
        page: pageSchema,
        size: sizeSchema,
      },
    },
    async ({ org_id, search, fields, page, size }) => {
      try {
        const payload = await client.get(
          "/api/v2/networks",
          {
            search,
            fields,
            page,
            size,
          },
          org_id,
        );
        return jsonResult(payload, {
          count: extractCollection(payload).length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_devices",
    {
      title: "List network devices",
      description:
        "List infrastructure devices (routers, switches, APs, etc.) via GET /api/v2/nodes. Matches the Inventory → Network Infrastructure view.",
      inputSchema: {
        org_id: orgIdSchema,
        type: deviceTypeSchema.default("Device"),
        search: z
          .string()
          .optional()
          .describe("Search string (hostname, IP, serial, etc.)."),
        hostname: z.string().optional().describe("Hostname prefix filter."),
        page: pageSchema,
        size: sizeSchema,
        fields: z
          .string()
          .optional()
          .describe(
            "Comma-separated CBD field paths. Default returns hostname, type, IP, serial, status.",
          ),
      },
    },
    async ({ org_id, type, search, hostname, page, size, fields }) => {
      try {
        const payload = await client.get(
          "/api/v2/nodes",
          {
            type,
            "search-str": search,
            hostname,
            page,
            size,
            fields:
              fields ||
              "/system-state/hostname,/system-state/type,/system-state/ip,/system-state/sn,/system-state/status,/system-state/model,/system-state/product-id",
          },
          org_id,
        );
        return jsonResult(payload, {
          count: extractCollection(payload).length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_hosts",
    {
      title: "List endpoint hosts",
      description:
        "List endpoint hosts (wired/wireless clients, IP phones, cameras) via GET /api/v2/nodes. Matches Inventory → Endpoints.",
      inputSchema: {
        org_id: orgIdSchema,
        type: z
          .enum(["Host", "IpPhone", "IpCamera", "NAS", "Others", "All"])
          .default("Host"),
        search: z.string().optional(),
        page: pageSchema,
        size: sizeSchema,
        fields: z.string().optional(),
      },
    },
    async ({ org_id, type, search, page, size, fields }) => {
      try {
        const payload = await client.get(
          "/api/v2/nodes",
          {
            type,
            "search-str": search,
            page,
            size,
            fields:
              fields ||
              "/system-state/hostname,/system-state/type,/system-state/ip,/system-state/mac,/system-state/status,/system-state/vendor",
          },
          org_id,
        );
        return jsonResult(payload, {
          count: extractCollection(payload).length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_node",
    {
      title: "Get node details",
      description:
        "Fetch a single device or host by node ID from Cisco Business Dashboard.",
      inputSchema: {
        node_id: z.string().describe("CBD node ID."),
        org_id: orgIdSchema,
        fields: z
          .string()
          .optional()
          .describe("Optional fields filter. Omit for full object."),
      },
    },
    async ({ node_id, org_id, fields }) => {
      try {
        const payload = await client.get(
          `/api/v2/nodes/${encodeURIComponent(node_id)}`,
          { fields },
          org_id,
        );
        return jsonResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "inventory_summary",
    {
      title: "Inventory summary",
      description:
        "Build an inventory summary similar to the CBD dashboard widget: totals for APs, switches, routers, and hosts, with online/offline counts when status is available.",
      inputSchema: {
        org_id: orgIdSchema,
        page_size: z
          .number()
          .int()
          .min(50)
          .max(500)
          .default(200)
          .describe("Page size used while scanning nodes."),
        max_pages: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Safety limit for pagination."),
      },
    },
    async ({ org_id, page_size, max_pages }) => {
      try {
        const typesToScan = ["Router", "Switch", "WAP", "Host", "IpPhone", "IpCamera"] as const;
        const byType: Record<
          string,
          { total: number; online: number; offline: number; unknown: number }
        > = {};

        for (const type of typesToScan) {
          byType[type] = { total: 0, online: 0, offline: 0, unknown: 0 };
          for (let page = 0; page < max_pages; page++) {
            const payload = await client.get(
              "/api/v2/nodes",
              {
                type,
                page,
                size: page_size,
                fields:
                  "/system-state/type,/system-state/status,/system-state/hostname",
              },
              org_id,
            );
            const items = extractCollection(payload);
            if (items.length === 0) break;

            for (const item of items) {
              const record = asRecord(item);
              if (!record) continue;
              const bucket = byType[type];
              bucket.total += 1;
              const status = String(
                getNested(record, "system-state/status") ??
                  record.status ??
                  "",
              ).toLowerCase();
              if (!status) {
                bucket.unknown += 1;
              } else if (
                status.includes("online") ||
                status.includes("up") ||
                status.includes("reachable") ||
                status === "ok" ||
                status === "normal"
              ) {
                bucket.online += 1;
              } else {
                bucket.offline += 1;
              }
            }

            if (items.length < page_size) break;
          }
        }

        const infrastructure = {
          ap: byType.WAP,
          switch: byType.Switch,
          router: byType.Router,
          total:
            byType.WAP.total + byType.Switch.total + byType.Router.total,
        };
        const endpoints = {
          host: byType.Host,
          ip_phone: byType.IpPhone,
          ip_camera: byType.IpCamera,
          total:
            byType.Host.total + byType.IpPhone.total + byType.IpCamera.total,
        };

        return jsonResult({
          infrastructure,
          endpoints,
          grand_total: infrastructure.total + endpoints.total,
          by_type: byType,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_events",
    {
      title: "List events / alerts",
      description:
        "List recent event history from Cisco Business Dashboard (GET /api/v2/events). Useful for the notification bell / alert feed.",
      inputSchema: {
        org_id: orgIdSchema,
        page: pageSchema,
        size: sizeSchema,
        search: z.string().optional(),
        severity: z
          .enum(["Alert", "Warning", "Info", "Normal"])
          .optional()
          .describe("Optional severity filter when supported by the instance."),
      },
    },
    async ({ org_id, page, size, search, severity }) => {
      try {
        const payload = await client.get(
          "/api/v2/events",
          {
            page,
            size,
            "search-str": search,
            severity,
          },
          org_id,
        );
        return jsonResult(payload, {
          count: extractCollection(payload).length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_groups",
    {
      title: "List device groups",
      description: "List device groups (GET /api/v2/groups).",
      inputSchema: {
        org_id: orgIdSchema,
      },
    },
    async ({ org_id }) => {
      try {
        const payload = await client.get("/api/v2/groups", undefined, org_id);
        return jsonResult(payload, {
          count: extractCollection(payload).length,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "cbd_api_get",
    {
      title: "Raw CBD GET",
      description:
        "Perform a raw read-only GET against any Cisco Business Dashboard API path under /api/v2. Use when a dedicated tool is missing (e.g. traffic counters, PnP, custom fields). Example path: /api/v2/nodes",
      inputSchema: {
        path: z
          .string()
          .describe("API path starting with /api/v2/, e.g. /api/v2/pnp/images"),
        query: z
          .record(z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe("Optional query string parameters as a JSON object."),
        org_id: orgIdSchema,
      },
    },
    async ({ path, query, org_id }) => {
      try {
        if (!path.startsWith("/api/v2/")) {
          return errorResult(
            new Error("path must start with /api/v2/ for safety."),
          );
        }
        const payload = await client.get(path, query, org_id);
        return jsonResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
