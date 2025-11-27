# SESAP Scripts Guide

## Overview

This project includes test scripts that run directly against Azure OpenAI - no mocking, real LLM calls.

## Prerequisites

1. **Environment Variables** - Ensure `.env` has:
   ```
   AZURE_AI_FOUNDRY_BASE_URL=https://poly-ai-foundry.cognitiveservices.azure.com
   AZURE_AI_FOUNDRY_KEY=<your-key>
   AZURE_GPT_5_MINI_DEPLOYMENT=gpt-5-mini
   ```

2. **Dependencies** - Already installed via `pnpm install`:
   - `tsx` - TypeScript execution
   - `dotenv` - Environment variable loading

## Available Scripts

### Transcript Analyzer Test

Analyzes a meeting transcript and extracts SSC (Smart Social Contract) elements.

```bash
pnpm test:transcript
```

**What it does:**
1. Loads `.env` variables
2. Reads the Coastal Elements transcript from `docs/`
3. Calls Azure OpenAI GPT-5-mini directly
4. Extracts parties, obligations, key terms, and suggests agreement type
5. Outputs structured JSON

**Sample output:**
```
✅ Analysis completed in 27.04s

Type: collaboration
Title: Coastal Elements AI — S.L. Nusbaum Introductory Collaboration & Discovery Plan
Confidence: 85%

👥 Parties (7):
  1. Coastal Elements AI - AI consultancy / solution provider
  2. Dylan Ryan - Founder / Principal
  ...

📋 Key Terms (14):
  1. Follow-up meeting: Mid-January
  ...

⚖️ Obligations (8):
  1. [Coastal Elements AI] Prepare workshop framework
  ...
```

## Creating New Scripts

1. Create file in `scripts/` directory
2. Load env first:
   ```typescript
   import { config } from "dotenv";
   import { resolve } from "path";
   
   config({ path: resolve(__dirname, "../.env") });
   ```
3. Use dynamic imports for modules that need env vars:
   ```typescript
   const { analyzeTranscript } = await import("../lib/ai/openai");
   ```
4. Add to `package.json`:
   ```json
   "scripts": {
     "your-script": "tsx scripts/your-script.ts"
   }
   ```

## Frontend Integration

The transcript analyzer is fully integrated with the dashboard UI.

### User Flow

1. Navigate to dashboard (`/`)
2. Click **"Analyze Transcript"** tab
3. Paste transcript text (minimum 50 characters)
4. Click **"Analyze Transcript"** button
5. Review extracted elements (parties, terms, obligations)
6. Assign wallet addresses to each party
7. Click **"Generate Full Agreement"** for contract draft
8. Click **"Save Agreement"** to persist to database

### Data Flow

```text
┌──────────────────────────────────────────────────────────────┐
│  TranscriptAnalyzer Component                                │
│    │                                                         │
│    ├─→ POST /api/agents/analyze                              │
│    │     └─→ analyzeTranscript() → Azure OpenAI gpt-5-mini   │
│    │                                                         │
│    └─→ POST /api/agreements                                  │
│          └─→ Prisma → PostgreSQL                             │
└──────────────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/analyze` | POST | Extract elements from transcript |
| `/api/agreements` | POST | Create new agreement |
| `/api/agreements` | GET | List user's agreements |
| `/api/agreements/[id]/sign` | POST | Sign an agreement |

## Azure OpenAI Notes

- **Model**: GPT-5-mini via Azure Cognitive Services
- **API Version**: 2025-01-01-preview
- **Client**: Uses `AzureOpenAI` class from `openai` package
- **Restrictions**:
  - Temperature must be 1 (default) - custom values not supported
  - `parallel_tool_calls` not supported without tools
  - JSON schema must have ALL properties in `required` array for strict mode
