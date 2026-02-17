# SESAP — AI Agent Instructions

> This file provides context and rules for AI coding agents working on the SESAP codebase.

## Active Competition

**Agents League — Creative Apps Track (GitHub Copilot)**
- Deadline: March 1, 2026 (11:59 PM PT)
- Strategy doc: `docs/AGENTS_LEAGUE_STRATEGY.md`
- Track: 🎨 Creative Apps — build innovative creative applications using AI-assisted development
- Requirements: Public repo, comprehensive README, demo video, GitHub Copilot usage documented, no hardcoded secrets
- MCP server for Copilot integration is the key differentiator (see strategy doc Phase 3)
- When implementing features, prioritize competition requirements (code quality, test coverage, MCP server, README, documentation)

## Project Summary

**SESAP** (Self-Executing Social Agreements Platform) is a decentralized application by **Poly186** for creating and executing Smart Social Contracts (SSCs). The current MVP is a **Template Playground** — a browser-based tool where users:

1. Paste or upload a meeting transcript
2. AI extracts contract structure and generates Accord Project artifacts
3. Users edit the generated model (.cto), template (.tem.md), and data (.json) in Monaco editors
4. A real-time preview renders the agreement as HTML via the Accord engine

## Quick Start

```bash
npm install          # Install all dependencies
npm run dev          # Start Vite frontend (port 5173)
# In separate terminal:
npx tsx server/api.ts  # Start Express API server (port 3001)
npm run test:unit    # Run unit tests
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Vite/React 18)    port 5173              │
│  ├── Zustand store           state management       │
│  ├── Monaco Editors          CTO / MD / JSON        │
│  ├── Ant Design 5.x         UI components           │
│  ├── Accord Engine           browser-side rendering  │
│  └── React Router            SPA routing             │
│           │                                          │
│           │ proxy /api/*                             │
│           ▼                                          │
│  Backend (Express 5)         port 3001              │
│  ├── POST /api/generate/contract                    │
│  ├── Azure OpenAI SDK 6.x   LLM calls              │
│  ├── Zod 4.x                structured output       │
│  └── Accord Engine           server-side rendering   │
│           │                                          │
│           ▼                                          │
│  Azure AI Foundry                                   │
│  ├── GPT-5.1     (heavy)    structure extraction    │
│  ├── GPT-5-mini  (medium)   artifact generation     │
│  └── GPT-5-nano  (light)    validation              │
└─────────────────────────────────────────────────────┘
```

## Contract Generation Pipeline

```
Transcript.txt
    ↓
Step 1: GPT-5.1 + ContractStructureSchema → structure.json
    ↓
Step 2: GPT-5-mini + AccordArtifactsSchema → model.cto + template.tem.md + data.json
    ↓
Step 3: GPT-5-mini + ValidationResultSchema → polished artifacts
    ↓
Accord Engine → agreement HTML
```

## Key Files

| File | Purpose |
|------|---------|
| `server/api.ts` | Express API, contract generation endpoint |
| `server/scripts/transcript-to-contract.ts` | 3-step LLM pipeline |
| `server/llm/azure-client.ts` | Azure OpenAI client with retry/tiers |
| `server/schemas/contract.ts` | Zod schemas for structured LLM output |
| `server/accord/engine.ts` | Server-side Accord rendering |
| `src/store/store.ts` | Zustand store, `rebuild()`, state management |
| `src/App.tsx` | App init, routing, theme |
| `src/main.tsx` | Entry point, Monaco config, noise suppression |
| `src/components/TranscriptUpload.tsx` | Transcript upload modal |
| `src/editors/ConcertoEditor.tsx` | Concerto model editor |
| `src/editors/MarkdownEditor.tsx` | TemplateMark template editor |
| `src/editors/JSONEditor.tsx` | JSON data editor |
| `vite.config.ts` | Build config, Node polyfills, API proxy |
| `package.json` | Deps, scripts, concerto-core override |

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript | 18.x / 4.x |
| State | Zustand (immer + devtools) | 4.x |
| UI | Ant Design + styled-components | 5.x |
| Editors | Monaco Editor | 0.50.x (CDN) |
| Contract Engine | Accord Project (Cicero, Concerto, template-engine) | 0.24.x / 3.20.x / 2.3.x |
| LLM | OpenAI SDK → Azure AI Foundry | 6.x |
| Schema | Zod | 4.x |
| Backend | Express | 5.x |
| Testing | Vitest + React Testing Library | 1.x |

## Critical Rules

### Accord Project / Concerto
- Namespace: `com.sesap.contract@1.0.0`
- Every JSON object MUST have `"$class": "com.sesap.contract@1.0.0.TypeName"`
- Main concept requires `@template` decorator
- Fields: `o String fieldName`, optional: `o String fieldName optional`
- Arrays (`o String[]`) ONLY at `@template` concept level — NOT in nested concepts
- Optional fields must be OMITTED from JSON, not set to null. `stripNullValues()` in `server/api.ts` handles this.

### TemplateMark
- Variables: `{{variableName}}`
- Nested concepts: `{{#clause conceptName}} ... {{/clause}}`
- String arrays: `{{#join arrayName}}` (inline, NO closing tag)
- Forbidden: `{{#if}}`, `{{#optional}}`, `{{#template}}`, `{{.}}`, `{{/join}}`

### Zod / OpenAI Structured Output
- ALL fields must be required — use `.nullable()` not `.optional()`
- No `z.record()` — use `z.string()` and parse JSON after
- No `z.any()` — use `z.unknown()` or specific types
- Arrays should never be nullable — use empty arrays
- See `docs/STRUCTURED_OUTPUT_LESSONS.md`

### State Management
- `rebuild()` is debounced at 500ms with cancelation semantics
- `setEditor*` methods are editor-only (no rebuild)
- `setTemplateMarkdown/setModelCto/setData` trigger rebuild
- `setContractArtifacts` sets all three + rebuilds (used by TranscriptUpload)
- StrictMode double-mount guarded by `initCalledRef` in `App.tsx`

### Dual Accord Engine
- Both `src/store/store.ts` (browser) and `server/accord/engine.ts` (server) render contracts
- Both hardcode `org.accordproject.money@0.3.0` money model
- If one is updated, the other MUST be updated too

## Gotchas

1. **Vite proxy**: `/api/*` → `localhost:3001`. Express server must be running.
2. **concerto-core override**: `package.json` overrides to `^3.20.4`. Don't remove.
3. **Console noise**: `main.tsx` suppresses CDN 404s, ResizeObserver errors. Real errors may be hidden.
4. **GPT-5.1 token budget**: Uses 50-80% for reasoning. Request 16K+ for 4K output.
5. **No database yet**: PostgreSQL integration is WIP, not yet connected.

## Conventions

- No barrel exports / index.ts files
- No mock implementations or TODOs in committed code
- `console.log` at critical nodes (API, LLM, Accord, state transitions)
- Optimize existing code before adding new files
- Use web search and Context7 for library docs — never guess
- User uses voice transcription — infer intent from context
- ASCII diagrams for every analysis and implementation plan
- Reports and analysis in chat only — no separate document files

## Documentation

| Doc | Purpose |
|-----|---------|
| `docs/AGENTS_LEAGUE_STRATEGY.md` | Competition strategy, roadmap, submission draft |
| `docs/STRUCTURED_OUTPUT_LESSONS.md` | LLM structured output pitfalls |
| `docs/WIP_MCP_STATUS.md` | Pipeline status and architecture |
| `docs/SCRIPTS.md` | Running scripts and test flows |
| `docs/IMPLEMENTATION.md` | Future MVP roadmap (full-stack) |
| `docs/SESAP Overview.md` | Product vision and mission |
| `docs/SESAP HandBook_ Internal.md` | Internal handbook and pricing |
| `docs/SSC_ Technicals_ Internal.md` | SSC technical architecture |
| `docs/Transcript_to_Document_Guidelines.md` | Transcript processing guidelines |
| `docs/SESAP MVP Roadmap_ Internal.md` | 6-phase MVP roadmap |
| `docs/SESAP MVP User Flow_ Internal.md` | User flows per phase |
| `docs/SESAP MVP User Stories_ Internal.md` | User stories per phase |
