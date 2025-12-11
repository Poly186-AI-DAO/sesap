/**
 * Transcript to Contract Generator
 * 
 * Converts meeting transcripts into Smart Social Contracts using:
 * 1. GPT-5.1 (heavy) - Extract contract structure from transcript
 * 2. GPT-5-mini (medium) - Generate Accord artifacts (Model, Template, Data)
 * 3. GPT-5-nano (light) - Validate and polish
 * 
 * Uses Zod schemas for type-safe structured output
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { chat, chatStructured } from '../llm/azure-client';
import { 
  ContractStructureSchema, 
  AccordArtifactsSchema, 
  ValidationResultSchema,
  type ContractStructure,
  type AccordArtifacts,
  type ValidationResult
} from '../schemas/contract';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EXTRACT_STRUCTURE_PROMPT = `You are a legal contract analyst. Your job is to analyze meeting transcripts and extract the key information needed to draft a professional services contract.

Extract the following from the transcript:

1. **Parties**: All parties involved with their roles
   - Provider (who does the work)
   - Intermediary (if any referral/partnership)
   - Client (who receives the work)

2. **Engagement Type**: What kind of work is being discussed
   - Audit/Assessment
   - Proof of Concept (POC)
   - Pilot Program
   - Full Implementation
   - Workshop/Training
   - Consulting

3. **Scope of Work**: What will be delivered
   - Key deliverables mentioned
   - Workshops or training
   - Reports or documentation
   - Technical implementations

4. **Timeline**: Any mentioned dates, durations, or phases

5. **Commercial Terms**: Any mentioned
   - Payment terms
   - Budget discussions
   - ROI expectations

6. **Next Steps**: Action items or follow-ups mentioned

7. **Key Quotes**: 2-3 important quotes that define the engagement

Respond in JSON format with this structure:
{
  "parties": {
    "provider": { "name": "", "role": "", "contacts": [] },
    "intermediary": { "name": "", "role": "", "contacts": [] } | null,
    "client": { "name": "", "role": "", "contacts": [] }
  },
  "engagementType": [],
  "scopeOfWork": {
    "deliverables": [],
    "phases": []
  },
  "timeline": {
    "startDate": "" | null,
    "duration": "",
    "milestones": []
  },
  "commercialTerms": {
    "paymentTerms": "" | null,
    "estimatedValue": "" | null,
    "roiExpectation": "" | null
  },
  "nextSteps": [],
  "keyQuotes": []
}`;

const GENERATE_ACCORD_PROMPT = `You are an expert in Accord Project Smart Legal Contracts. Your job is to generate the three components needed to create a Smart Social Contract:

1. **Concerto Model (.cto)**: The data model defining all contract variables
2. **TemplateMark Template (.tem.md)**: The contract text with variable placeholders
3. **JSON Data**: The populated data for this specific contract

Based on the extracted contract structure provided, generate a professional POC/Pilot Engagement Agreement.

The contract should include:
- Professional header with parties
- Recitals/Background section
- Scope of Work with phases
- Timeline and milestones
- Payment terms (propose reasonable terms if not specified)
- Confidentiality clause (brief)
- Termination clause (brief)
- Signatures section

CRITICAL Concerto Model (.cto) Syntax Rules:
- Namespace MUST include version: namespace org.accordproject.contract@1.0.0
- The MAIN contract type MUST have @template decorator on line before it
- Use "concept" for ALL data structures
- ALL fields MUST start with 'o' followed by type: \`o String fieldName\`
- Field types: String, Double, Integer, DateTime, Boolean
- Optional fields: put "optional" at END of line: \`o String notes optional\`
- Arrays use brackets: \`o String[] items\` - but ONLY at the TOP LEVEL (@template concept)
- DO NOT put arrays inside nested concepts - use comma-separated strings instead

IMPORTANT - FLAT STRUCTURE REQUIRED:
- Keep the model SIMPLE and FLAT
- Put arrays ONLY in the @template concept, NOT inside nested concepts
- For things like activities/outputs, use a SINGLE STRING with items separated by commas
- Example: Instead of \`o String[] activities\`, use \`o String activitiesSummary\` like "Design workshop, Create templates, Review materials"

Example Model Structure:
\`\`\`
@template
concept ContractData {
  o String contractId
  o Party provider
  o Party client  
  o String[] deliverables   // Array OK - it's at top level
  o String paymentTerms
}

concept Party {
  o String name
  o String role
  // NO arrays inside Party - keep it flat
}
\`\`\`

Important rules for TemplateMark:
- Use {{variableName}} for simple variables 
- Use {{#clause conceptName}} {{/clause}} for nested concepts
- Use {{#ulist listName}} {{.}} {{/ulist}} for arrays of primitives AT TOP LEVEL ONLY
- DO NOT nest {{#ulist}} inside {{#clause}} - this causes path resolution errors
- Keep template SIMPLE and FLAT
- Do NOT use {{#if}}, {{#optional}}, or {{#template}}

CRITICAL JSON Data Rules:
- EVERY object MUST have "$class": "org.accordproject.contract@1.0.0.TypeName"
- The root object uses the @template concept: "$class": "org.accordproject.contract@1.0.0.ContractData"
- Nested objects use their concept name: "$class": "org.accordproject.contract@1.0.0.Party"
- Arrays of concepts: each item needs $class
- Do NOT use null for optional fields - OMIT them entirely
- DateTime values must be ISO 8601 format: "2025-01-15T00:00:00Z"

Example JSON structure:
{
  "$class": "org.accordproject.contract@1.0.0.ContractData",
  "contractId": "ABC-123",
  "provider": {
    "$class": "org.accordproject.contract@1.0.0.Party",
    "name": "Acme Corp",
    "role": "Provider"
  }
}

Respond in JSON format:
{
  "concertoModel": "namespace ... (full .cto content)",
  "templateMark": "# Contract Title... (full .tem.md content)",
  "jsonData": { ... full JSON data with $class on every object ... }
}`;

const VALIDATE_POLISH_PROMPT = `You are a quality assurance specialist for Smart Legal Contracts.

Review the generated Accord Project artifacts and:
1. CRITICAL: Ensure EVERY variable used in the template ({{variableName}}) exists in the model
2. If a variable is used in template but NOT in model, either ADD it to the model or REMOVE it from template
3. Ensure all required fields in the model have values in the JSON data
4. Only add new standard clauses if they use EXISTING variables - do NOT invent new variables
5. Minor phrasing improvements are okay

If everything looks good, return the artifacts unchanged.
If there are issues, fix them and explain what you fixed.

IMPORTANT RULES:
- Do NOT add {{#template}} or {{/template}} wrappers
- Do NOT add variables to template that don't exist in model
- Every {{variable}} in template MUST have a corresponding field in the @template concept
- EVERY object in jsonData MUST have "$class": "org.accordproject.contract@1.0.0.TypeName"
- Do NOT use null values - OMIT optional fields entirely if not set
- If you find null values, REMOVE them from the JSON
- CRITICAL: REMOVE all {{#if}} and {{/if}} - TemplateMark does NOT support Handlebars conditionals
- CRITICAL: REMOVE all {{#optional}} and {{/optional}} - just show the field directly
- Replace patterns like "{{#if field}}...{{field}}...{{/if}}" with just "{{field}}" or remove the line entirely
- When iterating with {{#ulist}}, access fields directly like {{name}} not {{#if name}}{{name}}{{/if}}

Respond in JSON format:
{
  "isValid": true/false,
  "issues": ["list of issues found"] | [],
  "fixes": ["list of fixes applied"] | [],
  "concertoModel": "...",
  "templateMark": "...",
  "jsonData": { ... }
}`;

// ==================== MAIN FUNCTION ====================
// Types are imported from ../schemas/contract (Zod-inferred)


export async function transcriptToContract(
  transcriptPath: string,
  outputDir?: string
): Promise<{
  structure: ContractStructure;
  artifacts: AccordArtifacts;
  validation: ValidationResult;
  html: string;
}> {
  console.log('\n========================================');
  console.log('  TRANSCRIPT TO CONTRACT GENERATOR');
  console.log('========================================\n');

  // Read transcript
  console.log(`📄 Reading transcript: ${transcriptPath}`);
  const transcript = fs.readFileSync(transcriptPath, 'utf-8');
  console.log(`   Length: ${transcript.length} characters\n`);

  // STEP 1: Extract structure with GPT-5.1 (heavy reasoning) + Zod schema
  console.log('🧠 STEP 1: Extracting contract structure (GPT-5.1 + structured output)...');
  const structure = await chatStructured(
    'heavy',
    EXTRACT_STRUCTURE_PROMPT,
    `Here is the meeting transcript:\n\n${transcript}`,
    ContractStructureSchema,
    'ContractStructure',
    { maxTokens: 16384 }  // Increased - reasoning models need tokens for thinking + output
  );
  console.log(`   ✅ Extracted: ${structure.engagementType.join(', ')}`);
  console.log(`   Parties: ${structure.parties.provider.name} → ${structure.parties.client.name}\n`);

  // STEP 2: Generate Accord artifacts with GPT-5-mini + Zod schema
  console.log('⚙️  STEP 2: Generating Accord artifacts (GPT-5-mini + structured output)...');
  const artifacts = await chatStructured(
    'medium',
    GENERATE_ACCORD_PROMPT,
    `Here is the extracted contract structure:\n\n${JSON.stringify(structure, null, 2)}`,
    AccordArtifactsSchema,
    'AccordArtifacts',
    { maxTokens: 32768 }  // Large - needs room for reasoning + full .cto, .tem.md, and JSON
  );
  console.log(`   ✅ Generated Model, Template, and Data\n`);

  // STEP 3: Validate and polish with GPT-5-mini (upgraded from nano - nano runs out of tokens)
  let validation: ValidationResult;
  
  try {
    console.log('✨ STEP 3: Validating and polishing (GPT-5-mini + structured output)...');
    validation = await chatStructured(
      'medium',  // Changed from 'light' - nano exhausts tokens on reasoning
      VALIDATE_POLISH_PROMPT,
      `Here are the generated Accord artifacts:\n\n${JSON.stringify(artifacts, null, 2)}`,
      ValidationResultSchema,
      'ValidationResult',
      { maxTokens: 16384 }  // Increased for larger output
    );
    console.log(`   Valid: ${validation.isValid}`);
    if (validation.issues.length > 0) {
      console.log(`   Issues: ${validation.issues.join(', ')}`);
    }
    if (validation.fixes.length > 0) {
      console.log(`   Fixes: ${validation.fixes.join(', ')}`);
    }
  } catch (error) {
    console.log('   ⚠️  Validation step failed, using Step 2 artifacts directly');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    validation = {
      isValid: true,
      issues: [],
      fixes: ['Skipped validation step - using raw artifacts'],
      ...artifacts
    };
  }
  console.log('');

  // Save outputs
  const outDir = outputDir || path.join(path.dirname(transcriptPath), 'contract_output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const baseName = path.basename(transcriptPath, path.extname(transcriptPath));
  
  fs.writeFileSync(
    path.join(outDir, `${baseName}_structure.json`),
    JSON.stringify(structure, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outDir, `${baseName}_model.cto`),
    validation.concertoModel
  );
  
  fs.writeFileSync(
    path.join(outDir, `${baseName}_template.tem.md`),
    validation.templateMark
  );
  
  fs.writeFileSync(
    path.join(outDir, `${baseName}_data.json`),
    // jsonData is now a JSON string, pretty-print it
    // Sanitize control characters that LLMs sometimes output in JSON strings
    (() => {
      if (typeof validation.jsonData === 'string') {
        // Replace literal control characters with escaped versions
        const sanitized = validation.jsonData
          .replace(/[\x00-\x1F\x7F]/g, (char) => {
            const escapes: Record<string, string> = {
              '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f'
            };
            return escapes[char] || '';
          });
        try {
          return JSON.stringify(JSON.parse(sanitized), null, 2);
        } catch (e) {
          console.warn('   ⚠️  JSON parse failed, saving raw string');
          return sanitized;
        }
      }
      return JSON.stringify(validation.jsonData, null, 2);
    })()
  );

  console.log(`📁 Output saved to: ${outDir}`);
  console.log(`   - ${baseName}_structure.json`);
  console.log(`   - ${baseName}_model.cto`);
  console.log(`   - ${baseName}_template.tem.md`);
  console.log(`   - ${baseName}_data.json`);

  // STEP 4: Render to HTML using Accord Engine (optional)
  let html = '';
  try {
    console.log('\n📄 STEP 4: Rendering to HTML (Accord Engine)...');
    const { renderToHtml } = await import('../accord/engine');
    // Parse jsonData if it's a string (from structured output), with sanitization
    let jsonDataObj: Record<string, unknown>;
    if (typeof validation.jsonData === 'string') {
      const sanitized = validation.jsonData.replace(/[\x00-\x1F\x7F]/g, (char) => {
        const escapes: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };
        return escapes[char] || '';
      });
      jsonDataObj = JSON.parse(sanitized);
    } else {
      jsonDataObj = validation.jsonData as Record<string, unknown>;
    }
    const result = await renderToHtml(
      validation.concertoModel,
      validation.templateMark,
      jsonDataObj
    );
    
    if (result.success) {
      html = result.html;
      fs.writeFileSync(
        path.join(outDir, `${baseName}_contract.html`),
        html
      );
      console.log(`   ✅ HTML rendered and saved`);
      console.log(`   - ${baseName}_contract.html`);
    } else {
      console.log(`   ⚠️  HTML render failed: ${result.error}`);
      console.log('   (Artifacts saved, you can render manually in the playground)');
    }
  } catch (error) {
    console.log(`   ⚠️  HTML render skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log('   (Artifacts saved, you can render manually in the playground)');
  }

  console.log('\n========================================\n');

  return { structure, artifacts, validation, html };
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx ts-node transcript-to-contract.ts <transcript-path> [output-dir]');
    console.log('');
    console.log('Example:');
    console.log('  npx ts-node transcript-to-contract.ts ../docs/Coastal_Elements_AI_Introduction_SL_Nusbaum_Transcript.txt');
    process.exit(1);
  }

  const transcriptPath = path.resolve(args[0]);
  const outputDir = args[1] ? path.resolve(args[1]) : undefined;

  if (!fs.existsSync(transcriptPath)) {
    console.error(`Error: File not found: ${transcriptPath}`);
    process.exit(1);
  }

  try {
    await transcriptToContract(transcriptPath, outputDir);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Only run main() when script is executed directly, not when imported as a module
if (require.main === module) {
  main();
}
