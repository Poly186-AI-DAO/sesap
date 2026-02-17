/**
 * SESAP MCP Resources
 * 
 * Exposes sample templates and project information as MCP resources.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Sample playground template (imported inline to avoid ESM/CJS issues)
const PLAYGROUND_SAMPLE = {
  name: 'Customer Order',
  description: 'A sample template demonstrating Accord Project features: nested concepts, arrays, joins, monetary amounts, date formatting, and Ergo logic calculations.',
  model: `namespace hello@1.0.0
import org.accordproject.money@0.3.0.{MonetaryAmount} from https://models.accordproject.org/money@0.3.0.cto

concept Address {
    o String line1
    o String city
    o String state
    o String country
}

concept OrderLine {
    o String sku
    o Integer quantity
    o Double price
}

concept Order {
    o DateTime createdAt
    o OrderLine[] orderLines
}

@template
concept TemplateData {
    o String name
    o Address address
    o Integer age optional
    o MonetaryAmount salary
    o String[] favoriteColors
    o Order order
}`,
  template: `> A general sample that uses a range of features
### Welcome {{name}}!

{{#clause address}}  
#### Address
> {{line1}},  
 {{city}}, {{state}},  
 {{country}}  
 {{/clause}}

- You are *{{age}}* years old
- Your monthly salary is {{salary as "0,0.00 CCC"}}
- Your favorite colours are {{#join favoriteColors}}

{{#clause order}}
## Orders
Your last order was placed {{createdAt as "D MMMM YYYY"}}.

{{#ulist orderLines}}
- {{quantity}}x _{{sku}}_ @ £{{price as "0,0.00"}}
{{/ulist}}
{{/clause}}

Thank you.`,
};

export function registerResources(server: McpServer): void {
  // =====================================================================
  // Resource: sesap://samples
  // =====================================================================
  server.resource(
    'samples',
    'sesap://samples',
    {
      description: 'List available SESAP sample templates with their Concerto model, TemplateMark template, and example data',
      mimeType: 'application/json',
    },
    async (uri) => {
      const samples = [
        {
          name: PLAYGROUND_SAMPLE.name,
          description: PLAYGROUND_SAMPLE.description,
          model: PLAYGROUND_SAMPLE.model,
          template: PLAYGROUND_SAMPLE.template,
        },
      ];

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(samples, null, 2),
          mimeType: 'application/json',
        }],
      };
    }
  );

  // =====================================================================
  // Resource: sesap://info
  // =====================================================================
  server.resource(
    'info',
    'sesap://info',
    {
      description: 'Information about SESAP and the contract generation pipeline',
      mimeType: 'application/json',
    },
    async (uri) => {
      const info = {
        name: 'SESAP — Self-Executing Social Agreements Platform',
        description: 'Transforms meeting transcripts into legally-structured smart contracts using AI and the Accord Project stack.',
        pipeline: [
          'Step 1: Structure Extraction (GPT-5.1) — Analyzes transcript to identify parties, obligations, timelines',
          'Step 2: Artifact Generation (GPT-5-mini) — Generates Concerto model, TemplateMark template, JSON data',
          'Step 3: Validation & Polish (GPT-5-mini) — Cross-validates artifacts for Accord engine compatibility',
          'Step 4: Rendering (Accord Engine) — Transforms artifacts into formatted HTML agreement',
        ],
        artifactTypes: {
          'model.cto': 'Concerto data model defining contract variables and types',
          'template.tem.md': 'TemplateMark template with variable placeholders ({{variableName}})',
          'data.json': 'JSON data with $class properties for every object',
          'agreement.html': 'Rendered HTML agreement combining template + data',
        },
        tools: [
          'generate_contract — Full transcript-to-contract pipeline (30-60s)',
          'render_contract — Render artifacts to HTML',
          'validate_contract — Validate artifacts by attempting render',
        ],
        resources: [
          'sesap://samples — Available sample templates',
          'sesap://info — This information resource',
        ],
      };

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(info, null, 2),
          mimeType: 'application/json',
        }],
      };
    }
  );
}
