#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CbdClient } from "./cbd/client.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools/register.js";

async function main() {
  const config = loadConfig();
  const client = new CbdClient(config);

  const server = new McpServer({
    name: "cisco-business-dashboard",
    version: "1.0.0",
  });

  registerTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[cbd-mcp] Connected to ${config.baseUrl} (stdio MCP ready)`,
  );
}

main().catch((error) => {
  console.error("[cbd-mcp] Fatal error:", error);
  process.exit(1);
});
