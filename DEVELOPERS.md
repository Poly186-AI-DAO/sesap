# SESAP Developer Guide

Technical reference for developers working on the SESAP codebase.

## Prerequisites

- Node.js ≥ 18
- npm ≥ 6
- Azure AI Foundry account (for contract generation features)

## Setup

```bash
git clone https://github.com/Poly186-AI-DAO/sesap.git
cd sesap
npm install
cp .env.example .env   # Edit with your Azure credentials
```

## Running

```bash
# Frontend only (Template Playground — no API key needed)
npm run dev

# Backend API server (required for AI contract generation)
npm run server

# MCP server (for GitHub Copilot integration)
npm run mcp

# Run tests
npm test
```

## Architecture

```
Frontend (port 5173)  ──proxy /api/*──▶  Backend (port 3001)
├── React 18 + Vite 4                    ├── Express 5
├── Zustand (state)                      ├── Azure AI Foundry (LLM)
├── Monaco Editor                        ├── Accord Engine (server-side)
├── Accord Engine (browser-side)         └── Zod 4 (schema validation)
└── Ant Design 5 (UI)

MCP Server (stdio)
├── generate_contract
├── render_contract
└── validate_contract
```

### State Management

The Zustand store (`src/store/store.ts`) maintains two layers of state:

| Layer | Purpose | Updated by |
|-------|---------|-----------|
| Editor state | What the user sees in Monaco | `setEditorValue`, `setEditorModelCto`, `setEditorAgreementData` |
| Applied state | What the Accord engine uses | `setTemplateMarkdown`, `setModelCto`, `setData` |

The `rebuild()` function is debounced at 500ms. It:
1. Creates a `ModelManager` and adds the user's Concerto model + the hardcoded money model
2. Parses the TemplateMark template via `TemplateMarkTransformer`
3. Generates CiceroMark via `TemplateMarkInterpreter`
4. Transforms CiceroMark to HTML via `@accordproject/markdown-transform`

### LLM Pipeline

The 3-step pipeline in `server/scripts/transcript-to-contract.ts`:

| Step | Model | Input | Output | Schema |
|------|-------|-------|--------|--------|
| 1 | GPT-5.1 (heavy) | Transcript | Contract structure | `ContractStructureSchema` |
| 2 | GPT-5-mini | Structure + guidelines | Accord artifacts | `AccordArtifactsSchema` |
| 3 | GPT-5-mini | Artifacts | Validated artifacts | `ValidationResultSchema` |

### MCP Server

The MCP server (`server/mcp/`) uses stdio transport and registers tools/resources that Copilot Chat can invoke. It reuses the same backend modules (Accord engine, LLM pipeline) as the Express API.

## Key Files

| File | Description |
|------|-------------|
| `src/store/store.ts` | Zustand store — `rebuild()`, state management, debounce |
| `src/App.tsx` | App initialization, StrictMode guard, theme |
| `server/api.ts` | Express API, `stripNullValues()`, `/api/generate/contract` |
| `server/accord/engine.ts` | Server-side Accord rendering |
| `server/schemas/contract.ts` | Zod schemas for structured LLM output |
| `server/scripts/transcript-to-contract.ts` | 3-step LLM pipeline |
| `server/llm/azure-client.ts` | Azure OpenAI client with retry and model tiers |
| `server/mcp/tools.ts` | MCP tool registrations |
| `server/mcp/resources.ts` | MCP resource registrations |
| `vite.config.ts` | Build config, Node polyfills, API proxy |

## Common Gotchas

1. **`$class` required**: Every Concerto JSON object must have `"$class": "namespace@version.TypeName"`
2. **Null vs omit**: Concerto expects optional fields to be OMITTED, not null. Use `stripNullValues()` after LLM output
3. **`.nullable()` not `.optional()`**: OpenAI structured output requires all fields to be required
4. **`z.record()` is illegal**: OpenAI doesn't support it in structured output — use `z.string()` and parse after
5. **Money model sync**: Both `src/store/store.ts` and `server/accord/engine.ts` hardcode `org.accordproject.money@0.3.0` — keep them in sync
6. **Debounce cancelation**: `rebuild()` is debounced at 500ms. Canceled calls resolve (not reject) with `{ type: 'cancelation' }`
7. **Console noise suppression**: `src/main.tsx` filters CDN 404s and ResizeObserver errors — real errors may be hidden if they match patterns

## Testing

```bash
npm test          # Run all 53 tests
npx vitest        # Watch mode
npx vitest run    # Single run
```

Tests cover: Zod schemas, `stripNullValues`, store utilities (formatError, isCancelation, getInitialTheme), Navbar component, compression utilities.
