/**
 * AI Client for Agreement Generation
 * Uses Azure AI Foundry (Azure OpenAI) for contract generation
 * Validates against Concerto models
 */

import { AzureOpenAI } from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  validateAgreementData,
  getSampleData,
  type AgreementType,
} from "@/lib/accord";

type JsonSchema = Record<string, unknown>;
type StrictResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: JsonSchema;
    strict: true;
  };
};

const AGREEMENT_TYPE_ENUM: AgreementType[] = [
  "collaboration",
  "service",
  "investment",
  "custom",
  "nda",
  "nca",
  "tos",
  "constitution",
  "declaration",
];

const partySchema: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    identifiers: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["name", "role", "identifiers"],
  additionalProperties: false,
};

const extractedElementsSchema: JsonSchema = {
  type: "object",
  properties: {
    suggestedType: { type: "string", enum: AGREEMENT_TYPE_ENUM },
    parties: {
      type: "array",
      items: partySchema,
    },
    keyTerms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          value: { type: "string" },
          context: { type: "string" },
        },
        required: ["term", "value", "context"],
        additionalProperties: false,
      },
    },
    obligations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          party: { type: "string" },
          obligation: { type: "string" },
          deadline: { type: ["string", "null"] },
        },
        required: ["party", "obligation", "deadline"],
        additionalProperties: false,
      },
    },
    suggestedTitle: { type: "string" },
    summary: { type: "string" },
    confidence: { type: "number" },
  },
  required: [
    "suggestedType",
    "parties",
    "keyTerms",
    "obligations",
    "suggestedTitle",
    "summary",
    "confidence",
  ],
  additionalProperties: false,
};

const generatedContractSchema: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    markdown: { type: "string" },
    data: {
      type: "object",
      additionalProperties: true,
      description:
        "Structured contract data aligned to the requested agreement type schema.",
    },
  },
  required: ["title", "markdown", "data"],
  additionalProperties: false,
};

const generatedTemplateSchema: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    modelCto: { type: "string" },
    grammarMd: { type: "string" },
    logicErgo: { type: "string" },
  },
  required: ["name", "description", "modelCto", "grammarMd"],
  additionalProperties: false,
};

const extractedContractDataSchema: JsonSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      additionalProperties: true,
      description:
        "Key-value pairs that mirror the agreement's schema. Dates should be ISO strings.",
    },
  },
  required: ["data"],
  additionalProperties: false,
};

function buildStrictSchema(
  name: string,
  schema: JsonSchema
): StrictResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name,
      schema,
      strict: true,
    },
  };
}

function parseStructuredResponse<T>(completion: ChatCompletion): T {
  const message = completion.choices[0]?.message;

  if (!message) {
    throw new Error("No response from AI");
  }

  const parsed = (message as { parsed?: T }).parsed;
  if (parsed) {
    return parsed;
  }

  // Content is always a string in chat completions (not array like in other APIs)
  const content = message.content;

  if (!content) {
    throw new Error("No content in AI response");
  }

  return JSON.parse(content) as T;
}

// Initialize Azure OpenAI client
// Uses AzureOpenAI class from openai package for proper Azure integration
const client = new AzureOpenAI({
  apiKey: process.env.AZURE_AI_FOUNDRY_KEY,
  endpoint: process.env.AZURE_AI_FOUNDRY_BASE_URL,
  apiVersion: process.env.AZURE_OPEN_AI_VERSION || "2025-01-01-preview",
  deployment: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
});

export interface Party {
  name: string;
  walletAddress: string;
  role: string;
  email?: string;
}

export interface GenerateContractParams {
  type: AgreementType;
  description: string;
  parties: Party[];
  terms?: Record<string, unknown>;
}

export interface GeneratedContract {
  title: string;
  markdown: string;
  data: Record<string, unknown>;
  type: AgreementType;
}

/**
 * Generate a Smart Social Contract using AI
 */
export async function generateContract(
  params: GenerateContractParams
): Promise<GeneratedContract> {
  const sampleData = getSampleData(params.type);

  const systemPrompt = `You are an expert in creating Smart Social Contracts (SSCs) for the SESAP platform.
Generate clear, legally-aware but accessible contract documents in Markdown format.

Your contracts should be:
1. Clear and understandable to non-lawyers
2. Structured with proper headings and sections
3. Include all parties with their wallet addresses
4. Have clear terms, obligations, and conditions
5. Be enforceable as digital agreements

The contract type is: ${params.type}

Sample data structure for this type:
${JSON.stringify(sampleData, null, 2)}

Always respond with valid JSON containing:
- title: A concise title for the agreement
- markdown: The full contract text in Markdown format
- data: Structured data matching the agreement type schema`;

  const userPrompt = `Generate a Smart Social Contract with these details:

Type: ${params.type}
Description: ${params.description}

Parties:
${params.parties
  .map(
    (p, i) =>
      `${i + 1}. ${p.name} (${p.role}) - Wallet: ${p.walletAddress}${
        p.email ? `, Email: ${p.email}` : ""
      }`
  )
  .join("\n")}

Additional Terms: ${JSON.stringify(params.terms || {}, null, 2)}

Generate the contract now.`;

  const completion = await client.chat.completions.create({
    model: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: buildStrictSchema(
      "GeneratedContract",
      generatedContractSchema
    ),
    max_completion_tokens: 4000,
  });

  const result = parseStructuredResponse<{
    title: string;
    markdown: string;
    data: Record<string, unknown>;
  }>(completion);

  // Validate the generated data against our Concerto model
  const validation = validateAgreementData(params.type, {
    ...result.data,
    title: result.title,
    effectiveDate: result.data.effectiveDate || new Date().toISOString(),
    parties: params.parties,
  });

  if (!validation.valid) {
    console.warn("AI-generated data validation warnings:", validation.errors);
    // Don't throw - AI output may have different structure but still be valid
  }

  return {
    title: result.title,
    markdown: result.markdown,
    data: validation.data || result.data,
    type: params.type,
  };
}

/**
 * Improve or refine an existing contract
 */
export async function refineContract(
  currentContract: string,
  feedback: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert contract editor for Smart Social Contracts. Refine contracts based on feedback while maintaining clarity and enforceability. Return only the refined contract text in Markdown format.",
      },
      {
        role: "user",
        content: `Current contract:\n\n${currentContract}\n\nFeedback:\n${feedback}\n\nPlease provide the refined contract text in Markdown.`,
      },
    ],
    temperature: 0.5,
    max_completion_tokens: 4000,
  });

  return completion.choices[0]?.message?.content || currentContract;
}

/**
 * Summarize a contract for quick review
 */
export async function summarizeContract(contractText: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that summarizes contracts into key points. Be concise but comprehensive. Format as bullet points.",
      },
      {
        role: "user",
        content: `Summarize this contract into key points:\n\n${contractText}`,
      },
    ],
    temperature: 0.3,
    max_completion_tokens: 1000,
  });

  return (
    completion.choices[0]?.message?.content || "Unable to generate summary."
  );
}

/**
 * Extract structured data from contract text using AI
 */
export async function extractContractData(
  contractText: string,
  type: AgreementType
): Promise<Record<string, unknown>> {
  const sampleData = getSampleData(type);

  const completion = await client.chat.completions.create({
    model: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract structured data from a contract. Respond ONLY with JSON in the shape:\n{\n  "data": <object matching this structure>\n}\n\nExpected structure:\n${JSON.stringify(
          sampleData,
          null,
          2
        )}`,
      },
      {
        role: "user",
        content: `Extract data from this contract:\n\n${contractText}`,
      },
    ],
    response_format: buildStrictSchema(
      "ExtractedContractData",
      extractedContractDataSchema
    ),
    max_completion_tokens: 2000,
  });

  const result = parseStructuredResponse<{
    data: Record<string, unknown>;
  }>(completion);

  return result.data || {};
}

// ============================================================================
// TEMPLATE GENERATION
// ============================================================================

export interface GenerateTemplateParams {
  name: string;
  description: string;
  category: string;
  templateType: AgreementType;
  customRequirements?: string;
}

export interface GeneratedTemplate {
  name: string;
  description: string;
  modelCto: string;
  grammarMd: string;
  logicErgo?: string;
}

/**
 * Generate a reusable template using AI
 * Creates Concerto model (.cto) and Cicero grammar template (.tem.md)
 */
export async function generateTemplate(
  params: GenerateTemplateParams
): Promise<GeneratedTemplate> {
  const sampleData = getSampleData(params.templateType);

  const systemPrompt = `You are an expert in creating Smart Social Contract templates using the Accord Project framework.
You will generate templates that include:
1. A Concerto model (.cto) defining the data structure
2. A Cicero grammar template (.tem.md) with Handlebars-style variables

Template Guidelines:
- Concerto models should extend org.sesap.base@1.0.0.Agreement
- Use proper Concerto syntax with namespaces like org.sesap.${
    params.templateType
  }@1.0.0
- Grammar templates should use {{variable}} syntax for variable binding
- Include conditional sections with {{#if}} and loops with {{#each}}
- Make templates professional but accessible to non-lawyers
- Include digital signature sections for blockchain-based execution

Sample data structure for ${params.templateType}:
${JSON.stringify(sampleData, null, 2)}

Respond with valid JSON containing:
- name: Template name
- description: Template description
- modelCto: The Concerto model as a string
- grammarMd: The Cicero grammar template as a string
- logicErgo: (optional) Ergo business logic if needed`;

  const userPrompt = `Generate a Smart Social Contract template with these specifications:

Template Name: ${params.name}
Description: ${params.description}
Category: ${params.category}
Template Type: ${params.templateType}
${
  params.customRequirements
    ? `\nCustom Requirements:\n${params.customRequirements}`
    : ""
}

Generate the complete template now.`;

  const completion = await client.chat.completions.create({
    model: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: buildStrictSchema(
      "GeneratedTemplate",
      generatedTemplateSchema
    ),
    max_completion_tokens: 6000,
  });

  const result = parseStructuredResponse<GeneratedTemplate>(completion);

  return {
    name: result.name || params.name,
    description: result.description || params.description,
    modelCto: result.modelCto,
    grammarMd: result.grammarMd,
    logicErgo: result.logicErgo,
  };
}

// ============================================================================
// TRANSCRIPT/DOCUMENT ANALYSIS
// ============================================================================

export interface AnalyzeTranscriptParams {
  transcript: string;
  context?: string;
}

export interface ExtractedAgreementElements {
  suggestedType: AgreementType;
  parties: Array<{
    name: string;
    role: string;
    identifiers?: string[];
  }>;
  keyTerms: Array<{
    term: string;
    value: string;
    context: string;
  }>;
  obligations: Array<{
    party: string;
    obligation: string;
    deadline?: string;
  }>;
  suggestedTitle: string;
  summary: string;
  confidence: number;
}

/**
 * Analyze a transcript or document to extract SSC elements
 * Useful for converting meeting notes, discussions, or existing documents into SSCs
 */
export async function analyzeTranscript(
  params: AnalyzeTranscriptParams
): Promise<ExtractedAgreementElements> {
  const systemPrompt = `You are an expert legal analyst specializing in extracting contractual elements from transcripts and documents.
Your task is to analyze the provided text and extract elements that could form a Smart Social Contract (SSC).

Extract the following:
1. suggestedType: The most appropriate agreement type (collaboration, service, investment, nda, nca, tos, constitution, declaration, custom)
2. parties: All parties mentioned with their names, roles, and any identifiers (wallet addresses, emails, etc.)
3. keyTerms: Important terms, values, and their context (amounts, dates, percentages, etc.)
4. obligations: Commitments and obligations mentioned, including who is responsible and any deadlines
5. suggestedTitle: A concise title for the potential agreement
6. summary: A brief summary of the agreement's purpose
7. confidence: A score from 0-100 indicating how confident you are in the extraction

Be thorough but focus on concrete, actionable elements that could form a binding agreement.
Respond with valid JSON matching the structure described.`;

  const userPrompt = `Analyze this transcript/document and extract SSC elements:

${params.context ? `Context: ${params.context}\n\n` : ""}Document:
${params.transcript}`;

  const completion = await client.chat.completions.create({
    model: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: buildStrictSchema(
      "ExtractedAgreementElements",
      extractedElementsSchema
    ),
    max_completion_tokens: 4000,
  });

  return parseStructuredResponse<ExtractedAgreementElements>(completion);
}

/**
 * Convert extracted elements into a draft agreement
 */
export async function createAgreementFromElements(
  elements: ExtractedAgreementElements,
  walletAddresses: Record<string, string>
): Promise<GeneratedContract> {
  // Map parties to include wallet addresses
  const parties: Party[] = elements.parties.map((p) => ({
    name: p.name,
    role: p.role,
    walletAddress:
      walletAddresses[p.name] || "0x0000000000000000000000000000000000000000",
    email: p.identifiers?.find((id) => id.includes("@")),
  }));

  // Build description from summary and key terms
  const description = `${elements.summary}\n\nKey Terms:\n${elements.keyTerms
    .map((t) => `- ${t.term}: ${t.value}`)
    .join("\n")}\n\nObligations:\n${elements.obligations
    .map(
      (o) =>
        `- ${o.party}: ${o.obligation}${
          o.deadline ? ` (by ${o.deadline})` : ""
        }`
    )
    .join("\n")}`;

  // Generate the full contract
  return generateContract({
    type: elements.suggestedType,
    description,
    parties,
    terms: {
      keyTerms: elements.keyTerms,
      obligations: elements.obligations,
    },
  });
}
