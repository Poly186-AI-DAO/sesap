/**
 * Azure OpenAI Client - Cascading Model Architecture
 * 
 * Uses GPT-5.1 → GPT-5-mini → GPT-5-nano for different complexity levels
 */

import OpenAI from 'openai';

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

  // Azure AI Foundry URL format:
  // https://{resource}.cognitiveservices.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
  const azureBaseUrl = `${baseUrl}/openai/deployments/${deployment}`;

  console.log(`[Azure] Creating client for: ${azureBaseUrl}`);

  return new OpenAI({
    apiKey,
    baseURL: azureBaseUrl,
    defaultQuery: { 'api-version': apiVersion },
    defaultHeaders: { 'api-key': apiKey },
  });
}

export async function chat(
  tier: ModelTier,
  systemPrompt: string,
  userPrompt: string,
  options?: { 
    temperature?: number; 
    maxTokens?: number; 
    responseFormat?: 'text' | 'json_object';
  }
): Promise<string> {
  const deployment = MODEL_DEPLOYMENTS[tier];
  
  console.log(`[Azure ${tier.toUpperCase()}] Using deployment: ${deployment}`);
  
  // Create a client specifically for this deployment
  const client = createAzureClientForDeployment(deployment);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await client.chat.completions.create({
    model: deployment, // For Azure, this is mostly ignored since deployment is in URL
    messages,
    // Note: GPT-5.x models only support temperature=1 (default), so we don't set it
    // GPT-5.x models use max_completion_tokens instead of max_tokens
    max_completion_tokens: options?.maxTokens ?? 4096,
    response_format: options?.responseFormat === 'json_object' 
      ? { type: 'json_object' } 
      : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from Azure OpenAI');
  }

  console.log(`[Azure ${tier.toUpperCase()}] Tokens: ${response.usage?.total_tokens || 'unknown'}`);
  
  return content;
}

export { MODEL_DEPLOYMENTS };

