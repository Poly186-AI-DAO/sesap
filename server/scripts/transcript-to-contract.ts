/**
 * Transcript to Contract Generator
 * 
 * Converts meeting transcripts into Smart Social Contracts using:
 * 1. GPT-5.1 (heavy) - Extract contract structure from transcript
 * 2. GPT-5-mini (medium) - Generate Accord artifacts (Model, Template, Data)
 * 3. GPT-5-nano (light) - Validate and polish
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { chat } from '../llm/azure-client';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ==================== PROMPTS ====================

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

Important rules for TemplateMark:
- Use {{variableName}} for simple variables
- Use {{#clause conceptName}} {{/clause}} for nested concepts
- Use {{#if condition}} {{/if}} for conditionals
- Use {{#ulist listName}} {{/ulist}} for lists
- Keep it professional but readable

Respond in JSON format:
{
  "concertoModel": "namespace ... (full .cto content)",
  "templateMark": "# Contract Title... (full .tem.md content)",
  "jsonData": { ... full JSON data ... }
}`;

const VALIDATE_POLISH_PROMPT = `You are a quality assurance specialist for Smart Legal Contracts.

Review the generated Accord Project artifacts and:
1. Check for any obvious errors or inconsistencies
2. Ensure all variables in the template exist in the model
3. Ensure all required fields in the model have values in the JSON data
4. Improve any awkward phrasing
5. Add any missing standard clauses

If everything looks good, return the artifacts unchanged.
If there are issues, fix them and explain what you fixed.

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

interface ContractStructure {
  parties: {
    provider: { name: string; role: string; contacts: string[] };
    intermediary: { name: string; role: string; contacts: string[] } | null;
    client: { name: string; role: string; contacts: string[] };
  };
  engagementType: string[];
  scopeOfWork: {
    deliverables: string[];
    phases: string[];
  };
  timeline: {
    startDate: string | null;
    duration: string;
    milestones: string[];
  };
  commercialTerms: {
    paymentTerms: string | null;
    estimatedValue: string | null;
    roiExpectation: string | null;
  };
  nextSteps: string[];
  keyQuotes: string[];
}

interface AccordArtifacts {
  concertoModel: string;
  templateMark: string;
  jsonData: Record<string, unknown>;
}

interface ValidationResult extends AccordArtifacts {
  isValid: boolean;
  issues: string[];
  fixes: string[];
}

export async function transcriptToContract(
  transcriptPath: string,
  outputDir?: string
): Promise<{
  structure: ContractStructure;
  artifacts: AccordArtifacts;
  validation: ValidationResult;
}> {
  console.log('\n========================================');
  console.log('  TRANSCRIPT TO CONTRACT GENERATOR');
  console.log('========================================\n');

  // Read transcript
  console.log(`📄 Reading transcript: ${transcriptPath}`);
  const transcript = fs.readFileSync(transcriptPath, 'utf-8');
  console.log(`   Length: ${transcript.length} characters\n`);

  // STEP 1: Extract structure with GPT-5.1 (heavy reasoning)
  console.log('🧠 STEP 1: Extracting contract structure (GPT-5.1)...');
  const structureJson = await chat(
    'heavy',
    EXTRACT_STRUCTURE_PROMPT,
    `Here is the meeting transcript:\n\n${transcript}`,
    { responseFormat: 'json_object', maxTokens: 8192 }
  );
  
  const structure: ContractStructure = JSON.parse(structureJson);
  console.log(`   ✅ Extracted: ${structure.engagementType.join(', ')}`);
  console.log(`   Parties: ${structure.parties.provider.name} → ${structure.parties.client.name}\n`);

  // STEP 2: Generate Accord artifacts with GPT-5-mini
  console.log('⚙️  STEP 2: Generating Accord artifacts (GPT-5-mini)...');
  const artifactsJson = await chat(
    'medium',
    GENERATE_ACCORD_PROMPT,
    `Here is the extracted contract structure:\n\n${JSON.stringify(structure, null, 2)}`,
    { responseFormat: 'json_object', maxTokens: 8192 }
  );

  const artifacts: AccordArtifacts = JSON.parse(artifactsJson);
  console.log(`   ✅ Generated Model, Template, and Data\n`);

  // STEP 3: Validate and polish with GPT-5-nano (optional - fallback to Step 2 if fails)
  let validation: ValidationResult;
  
  try {
    console.log('✨ STEP 3: Validating and polishing (GPT-5-nano)...');
    const validationJson = await chat(
      'light',
      VALIDATE_POLISH_PROMPT,
      `Here are the generated Accord artifacts:\n\n${JSON.stringify(artifacts, null, 2)}`,
      { responseFormat: 'json_object', maxTokens: 8192 }
    );

    validation = JSON.parse(validationJson);
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
    JSON.stringify(validation.jsonData, null, 2)
  );

  console.log(`📁 Output saved to: ${outDir}`);
  console.log(`   - ${baseName}_structure.json`);
  console.log(`   - ${baseName}_model.cto`);
  console.log(`   - ${baseName}_template.tem.md`);
  console.log(`   - ${baseName}_data.json`);
  console.log('\n========================================\n');

  return { structure, artifacts, validation };
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

main();
