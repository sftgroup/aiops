#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

async function main() {
  const baseUrl = process.env.AIOPS_BASE_URL;
  const apiKey = process.env.AIOPS_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error("AIOPS_BASE_URL and AIOPS_API_KEY environment variables are required");
    process.exit(1);
  }

  const server = new McpServer({
    name: "aiops-mcp-server",
    version: "0.1.0",
  });

  registerTools(server, baseUrl, apiKey);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP Server error:", err);
  process.exit(1);
});
