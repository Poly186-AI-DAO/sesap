/**
 * SESAP MCP Server
 *
 * Exposes SESAP's contract generation, validation, and rendering
 * as tools for GitHub Copilot and other MCP-compatible clients.
 *
 * Transport: stdio (for VS Code Copilot integration)
 *
 * Tools:
 *   - generate_contract: Transcript → Accord contract artifacts + HTML
 *   - validate_contract: Validate Accord artifacts (model + template + data)
 *   - render_contract:   Render Accord artifacts to HTML
 *
 * Resources:
 *   - sesap://samples: List available sample templates
 *
 * Usage:
 *   npx tsx server/mcp/index.ts
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const server = new McpServer(
    {
      name: "sesap",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  // Register all tools and resources
  registerTools(server);
  registerResources(server);

  // Connect via stdio transport for VS Code Copilot
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error("[SESAP MCP] Server started on stdio transport");
}

main().catch((error) => {
  console.error("[SESAP MCP] Fatal error:", error);
  process.exit(1);
});
