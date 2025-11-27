/**
 * AI Client for Agreement Generation
 * Uses Azure AI Foundry (Azure OpenAI) for contract generation
 * Validates against Concerto models
 */

import OpenAI from "openai";
import {
  validateAgreementData,
  getSampleData,
  type AgreementType,
} from "@/lib/accord";

// Initialize Azure OpenAI client
const client = new OpenAI({
  apiKey: process.env.AZURE_AI_FOUNDRY_KEY,
  baseURL: `${process.env.AZURE_AI_FOUNDRY_BASE_URL}/openai/deployments/${
    process.env.AZURE_GPT_5_MINI_DEPLOYMENT || "gpt-4o-mini"
  }`,
  defaultQuery: {
    "api-version": process.env.AZURE_OPEN_AI_VERSION || "2025-01-01-preview",
  },
  defaultHeaders: { "api-key": process.env.AZURE_AI_FOUNDRY_KEY },
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
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI");
  }

  const result = JSON.parse(content) as {
    title: string;
    markdown: string;
    data: Record<string, unknown>;
  };

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
    max_tokens: 4000,
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
    max_tokens: 1000,
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
        content: `Extract structured data from a contract. Return JSON matching this structure:\n${JSON.stringify(
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
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    return {};
  }

  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
