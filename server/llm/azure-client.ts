/**
 * Azure OpenAI Client - Robust Version
 * 
 * Features:
 * - Cascading model tiers (heavy/medium/light)
 * - Zod structured output for type-safe parsing
 * - Retry logic with exponential backoff
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export interface AzureConfig {
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
}

export type ModelTier = 'heavy' | 'medium' | 'light';

const MODEL_DEPLOYMENTS: Record<ModelTier, string> = {
  heavy: process.env.AZURE_GPT_5_1_DEPLOYMENT || 'gpt-5.1',
  medium: process.env.AZURE_GPT_5_MINI_DEPLOYMENT || 'gpt-5-mini',
  light: process.env.AZURE_GPT_5_NANO_DEPLOYMENT || 'gpt-5-nano',
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an Azure OpenAI client for a specific deployment
 */
export function createAzureClientForDeployment(
  deployment: string, 
  config?: Partial<AzureConfig>
): OpenAI {
  const baseUrl = config?.baseUrl || process.env.AZURE_AI_FOUNDRY_BASE_URL;
  const apiKey = config?.apiKey || process.env.AZURE_AI_FOUNDRY_KEY;
  const apiVersion = config?.apiVersion || process.env.AZURE_OPEN_AI_VERSION || '2025-01-01-preview';

  if (!baseUrl || !apiKey) {
    throw new Error('Azure AI Foundry credentials not configured. Set AZURE_AI_FOUNDRY_BASE_URL and AZURE_AI_FOUNDRY_KEY.');
  }

  const azureBaseUrl = `${baseUrl}/openai/deployments/${deployment}`;

  return new OpenAI({
    apiKey,
    baseURL: azureBaseUrl,
    defaultQuery: { 'api-version': apiVersion },
    defaultHeaders: { 'api-key': apiKey },
  });
}

/**
 * Chat with retry logic (for non-structured output)
 */
export async function chat(
  tier: ModelTier,
  systemPrompt: string,
  userPrompt: string,
  options?: { 
    maxTokens?: number; 
    responseFormat?: 'text' | 'json_object';
  }
): Promise<string> {
  const deployment = MODEL_DEPLOYMENTS[tier];
  console.log(`[Azure ${tier.toUpperCase()}] Using deployment: ${deployment}`);
  
  const client = createAzureClientForDeployment(deployment);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[Azure] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await sleep(delay);
      }

      const response = await client.chat.completions.create({
        model: deployment,
        messages,
        max_completion_tokens: options?.maxTokens ?? 4096,
        response_format: options?.responseFormat === 'json_object' 
          ? { type: 'json_object' } 
          : undefined,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from Azure OpenAI');
      }

      console.log(`[Azure ${tier.toUpperCase()}] Tokens: ${response.usage?.total_tokens || 'unknown'}`);
      return content;

    } catch (error) {
      lastError = error as Error;
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        console.error(`[Azure] Error (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
        throw lastError;
      }
      
      console.warn(`[Azure] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Chat with Zod structured output (type-safe parsing)
 * Uses zodResponseFormat for true schema-enforced JSON output
 * The model is constrained to output JSON that matches the schema exactly
 */
export async function chatStructured<T extends z.ZodType>(
  tier: ModelTier,
  systemPrompt: string,
  userPrompt: string,
  schema: T,
  schemaName: string,
  options?: { maxTokens?: number }
): Promise<z.infer<T>> {
  const deployment = MODEL_DEPLOYMENTS[tier];
  console.log(`[Azure ${tier.toUpperCase()}] Using deployment: ${deployment} (structured: ${schemaName})`);
  
  const client = createAzureClientForDeployment(deployment);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[Azure] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await sleep(delay);
      }

      // Use zodResponseFormat for true schema-enforced structured output
      // This guarantees the model outputs JSON matching the exact schema
      const response = await client.chat.completions.create({
        model: deployment,
        messages,
        max_completion_tokens: options?.maxTokens ?? 8192,
        response_format: zodResponseFormat(schema, schemaName),
      });

      const content = response.choices[0]?.message?.content;
      const choice = response.choices[0];
      
      // Debug: log full response if content is empty
      if (!content) {
        console.log(`[Azure ${tier.toUpperCase()}] DEBUG - Empty content, full response:`);
        console.log(`  finish_reason: ${choice?.finish_reason}`);
        console.log(`  refusal: ${choice?.message?.refusal || 'none'}`);
        console.log(`  usage: ${JSON.stringify(response.usage)}`);
        console.log(`  model: ${response.model}`);
        throw new Error(`No response content from Azure OpenAI (finish_reason: ${choice?.finish_reason})`);
      }

      // Parse and validate with Zod (double-check, though schema enforcement should guarantee this)
      const parsed = JSON.parse(content);
      const validated = schema.parse(parsed);

      console.log(`[Azure ${tier.toUpperCase()}] Tokens: ${response.usage?.total_tokens || 'unknown'}`);
      return validated;

    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a Zod validation error (could indicate schema mismatch)
      if (error instanceof z.ZodError) {
        const zodErr = error as z.ZodError;
        console.error(`[Azure] Zod validation failed:`, zodErr.issues);
        throw new Error(`Schema validation failed: ${zodErr.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        console.error(`[Azure] Error (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
        throw lastError;
      }
      
      console.warn(`[Azure] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Check if an error is retryable (rate limits, transient errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }
    
    // Transient server errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }
  }
  
  return false;
}

export { MODEL_DEPLOYMENTS };
