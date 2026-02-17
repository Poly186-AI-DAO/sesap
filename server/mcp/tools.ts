/**
 * SESAP MCP Tools
 *
 * Registers contract generation, validation, and rendering tools
 * with the MCP server.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { transcriptToContract } from "../scripts/transcript-to-contract.js";
import { renderToHtml } from "../accord/engine.js";

/**
 * Strip null/undefined values from objects recursively.
 * Concerto expects optional fields to be OMITTED, not null.
 */
function stripNullValues(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj))
    return obj.map(stripNullValues).filter((item: any) => item !== undefined);
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const stripped = stripNullValues(value);
      if (stripped !== undefined) result[key] = stripped;
    }
    return result;
  }
  return obj;
}

export function registerTools(server: McpServer): void {
  // =====================================================================
  // Tool: generate_contract
  // =====================================================================
  server.tool(
    "generate_contract",
    "Generate Accord Project contract artifacts from a meeting transcript. " +
      "Uses a 3-step AI pipeline: structure extraction (GPT-5.1), artifact generation (GPT-5-mini), " +
      "and validation (GPT-5-mini). Returns Concerto model (.cto), TemplateMark template (.tem.md), " +
      "JSON data, and rendered HTML. Takes 30-60 seconds.",
    {
      transcript: z
        .string()
        .describe(
          "The meeting transcript text to convert into a contract. Must be at least 100 characters.",
        ),
    },
    async ({ transcript }) => {
      if (transcript.length < 100) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Transcript must be at least 100 characters",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        console.error(
          `[SESAP MCP] Generating contract from transcript (${transcript.length} chars)`,
        );

        // Write transcript to temp file (pipeline reads from file)
        const tempFile = path.join(os.tmpdir(), `sesap-mcp-${Date.now()}.txt`);
        fs.writeFileSync(tempFile, transcript);

        const result = await transcriptToContract(tempFile);

        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch {
          /* ignore */
        }

        // Clean data for Concerto compatibility
        let cleanedData: string;
        try {
          const rawData =
            typeof result.validation.jsonData === "string"
              ? JSON.parse(result.validation.jsonData)
              : result.validation.jsonData;
          cleanedData = JSON.stringify(stripNullValues(rawData), null, 2);
        } catch {
          cleanedData =
            typeof result.validation.jsonData === "string"
              ? result.validation.jsonData
              : JSON.stringify(result.validation.jsonData, null, 2);
        }

        const output = {
          model: result.validation.concertoModel,
          template: result.validation.templateMark,
          data: cleanedData,
          html: result.html || "",
          structure: result.structure,
        };

        console.error("[SESAP MCP] Contract generated successfully");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(output, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[SESAP MCP] Contract generation failed:", message);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Contract generation failed: ${message}`,
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // =====================================================================
  // Tool: render_contract
  // =====================================================================
  server.tool(
    "render_contract",
    "Render Accord Project artifacts (Concerto model, TemplateMark template, JSON data) to HTML. " +
      "Use this to preview contract output from existing artifacts.",
    {
      model: z.string().describe("Concerto model content (.cto file content)"),
      template: z
        .string()
        .describe("TemplateMark template content (.tem.md file content)"),
      data: z
        .string()
        .describe("JSON data string with $class properties on every object"),
    },
    async ({ model, template, data }) => {
      try {
        console.error("[SESAP MCP] Rendering contract...");

        // Parse and clean data
        let dataObj: Record<string, unknown>;
        try {
          const parsed = JSON.parse(data);
          dataObj = stripNullValues(parsed) as Record<string, unknown>;
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Invalid JSON data" }),
              },
            ],
            isError: true,
          };
        }

        const result = await renderToHtml(model, template, dataObj);

        if (result.success) {
          console.error("[SESAP MCP] Contract rendered successfully");
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ html: result.html, success: true }),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: result.error, success: false }),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[SESAP MCP] Render failed:", message);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Render failed: ${message}` }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // =====================================================================
  // Tool: validate_contract
  // =====================================================================
  server.tool(
    "validate_contract",
    "Validate Accord Project artifacts by attempting to render them. " +
      "Returns whether the artifacts are valid and any error messages.",
    {
      model: z.string().describe("Concerto model content (.cto)"),
      template: z.string().describe("TemplateMark template content (.tem.md)"),
      data: z.string().describe("JSON data string"),
    },
    async ({ model, template, data }) => {
      try {
        console.error("[SESAP MCP] Validating contract artifacts...");

        let dataObj: Record<string, unknown>;
        try {
          const parsed = JSON.parse(data);
          dataObj = stripNullValues(parsed) as Record<string, unknown>;
        } catch (parseError) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  valid: false,
                  errors: [
                    `JSON data is not valid JSON: ${
                      parseError instanceof Error
                        ? parseError.message
                        : "parse error"
                    }`,
                  ],
                }),
              },
            ],
          };
        }

        const result = await renderToHtml(model, template, dataObj);

        const output = {
          valid: result.success,
          errors: result.success
            ? []
            : [result.error || "Unknown validation error"],
          html: result.success ? result.html : undefined,
        };

        console.error(
          `[SESAP MCP] Validation result: ${
            result.success ? "valid" : "invalid"
          }`,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(output, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("[SESAP MCP] Validation failed:", message);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                valid: false,
                errors: [`Validation failed: ${message}`],
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
