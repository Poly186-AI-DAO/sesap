---
applyTo: "**"
---

# SESAP Implementation Instructions

## Active Competition

**Agents League — Creative Apps Track (GitHub Copilot)** — Deadline: March 1, 2026

- Strategy and full roadmap: `docs/AGENTS_LEAGUE_STRATEGY.md`
- Current implementation priorities (in order):
  1. Code cleanup & sanitization (remove dead code, empty dirs, build logs)
  2. Code quality & test coverage (reliability & safety = 20% of rubric)
  3. MCP server for GitHub Copilot integration (key differentiator)
  4. Competition-grade README with screenshots and architecture diagrams
  5. GitHub Copilot usage documentation (COPILOT_USAGE.md)
  6. Demo video (required for submission)
- All new code must be production-quality and open-source ready
- No internal/proprietary information in committed code or docs

## What is SESAP?

SESAP (Self-Executing Social Agreements Platform) is a decentralized application by Poly186 for creating and executing Smart Social Contracts (SSCs). The current MVP is a **Template Playground** — a browser-based tool for designing, testing, and generating SSCs from meeting transcripts using AI (Azure OpenAI) and the Accord Project stack (Concerto models, TemplateMark templates, CiceroMark rendering).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SESAP ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Frontend - Vite 4 / React 18]                                  │
│   ├── src/store/store.ts        Zustand (immer + devtools)       │
│   ├── src/editors/*             Monaco Editors (CTO, MD, JSON)   │
│   ├── src/components/*          Ant Design 5.x + styled-comp     │
│   ├── src/App.tsx               Init, routing, theme             │
│   └── vite.config.ts            Proxy /api/* → localhost:3001    │
│                                                                  │
│  [Backend - Express 5 / TypeScript]                              │
│   ├── server/api.ts             POST /api/generate/contract      │
│   ├── server/llm/azure-client   Azure OpenAI SDK 6.x            │
│   ├── server/schemas/contract   Zod 4.x structured output       │
│   ├── server/scripts/*          3-step LLM pipeline              │
│   └── server/accord/engine.ts   Server-side Accord rendering    │
│                                                                  │
│  [External]                                                      │
│   ├── Azure AI Foundry          GPT-5.1 / GPT-5-mini / GPT-5-nano│
│   └── Accord Project            Concerto + TemplateMark + Ergo   │
│                                                                  │
│  [Storage - WIP]                                                 │
│   └── PostgreSQL (not yet integrated)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Core Data Flow

```
Transcript → GPT-5.1 (structure extraction)
                │
                ▼
         GPT-5-mini (Accord artifact generation)
                │
                ▼
         GPT-5-mini (validation & polish)
                │
                ▼
         Accord Engine (Concerto + TemplateMark → HTML)
                │
                ▼
         Frontend editors populated, agreement preview rendered
```

## Tech Stack

| Layer           | Technology                                         | Version                 |
| --------------- | -------------------------------------------------- | ----------------------- |
| Frontend        | React + Vite + TypeScript                          | 18.x / 4.x / 5.x        |
| State           | Zustand                                            | 4.x (immer + devtools)  |
| UI              | Ant Design + styled-components                     | 5.x                     |
| Editors         | Monaco Editor                                      | 0.50.x (CDN-loaded)     |
| Contract Engine | Accord Project (Cicero, Concerto, template-engine) | 0.24.x / 3.20.x / 2.3.x |
| LLM             | OpenAI SDK → Azure AI Foundry                      | 6.x                     |
| Schema          | Zod                                                | 4.x                     |
| Backend         | Express                                            | 5.x                     |
| Testing         | Vitest + React Testing Library                     | 1.x                     |

## Implementation Protocol

### Before Writing Any Code

1. **Inspect the relevant files** using your tools. Search the codebase. Read every file in the dependency chain.
2. **Build an ASCII diagram** of the data flow and dependency graph for the area you're changing.
3. **Present your plan** in chat. Include: what you're changing, why, and how it affects other files.
4. **Wait for approval** before touching code.

### While Implementing

1. Work one file at a time. Open the file, propose changes, implement, review, then move on.
2. Stay aware of the dependency graph. Every change has downstream effects — track them.
3. Write production-quality code. No placeholders, no TODOs, no mock implementations.
4. Add concise comments at critical decision points. Don't over-comment obvious logic.
5. Add `console.log` at critical nodes (API entry/exit, LLM calls, Accord rendering, state transitions).
6. Test after each change. Run `npm run test:unit` to verify nothing breaks.

### What NOT To Do

- **No mock implementations.** Every function must be fully implemented and production-ready.
- **No backwards compatibility shims.** Clean up old code, don't leave tech debt.
- **No new files unless absolutely necessary.** Optimize existing code first.
- **No init files** (index.ts barrel exports). We don't use them.
- **No placeholder values or TODO comments** left in code.
- **No guessing.** You have tools to read every file. Use them.
- **No report files or documents** unless explicitly requested. Keep analysis in chat.

## Key Implementation Patterns

### Zustand Store (src/store/store.ts)

```
Editor State (what user sees) → Applied State (what Accord uses) → rebuild() → HTML output

- setEditorValue/setEditorModelCto/setEditorAgreementData → editor-only, no rebuild
- setTemplateMarkdown/setModelCto/setData → triggers rebuildDeBounce (500ms)
- setContractArtifacts → sets all three + triggers rebuild (used by TranscriptUpload)
```

- The `rebuild()` function is debounced at 500ms. Previous calls resolve as cancelations (not rejections).
- The `init()` function checks URL params for shared links before defaulting to playground samples.
- StrictMode double-mount is guarded via `initCalledRef` in `App.tsx`.

### Accord Project Rendering

```
Input: model.cto + template.tem.md + data.json
   │
   ▼
ModelManager.addCTOModel(model)
ModelManager.addCTOModel(moneyModel)  ← hardcoded, no network fetch
   │
   ▼
TemplateMarkTransformer.fromMarkdownTemplate(template, modelManager)
   │
   ▼
TemplateMarkInterpreter.generate(templateMarkDom, data)
   │
   ▼
transform(ciceroMark, "ciceromark_parsed", ["html"])
   │
   ▼
Output: HTML string
```

**Both `src/store/store.ts` and `server/accord/engine.ts` implement this.** They must stay in sync.

### LLM Pipeline (server/scripts/transcript-to-contract.ts)

- Step 1: `chatStructured('heavy', ..., ContractStructureSchema)` — 16K tokens
- Step 2: `chatStructured('medium', ..., AccordArtifactsSchema)` — 32K tokens
- Step 3: `chatStructured('medium', ..., ValidationResultSchema)` — 32K tokens
- Uses Zod schemas from `server/schemas/contract.ts` for type-safe structured output

### Zod Schema Rules (OpenAI Structured Output)

- ALL fields must be required. Use `.nullable()` instead of `.optional()`.
- No `z.record()` — use `z.string()` and parse JSON after.
- No `z.any()` — use `z.unknown()` or specific types.
- Arrays should never be nullable — use empty arrays as defaults.
- See `docs/STRUCTURED_OUTPUT_LESSONS.md` for full reference.

### Concerto Model Rules

- Namespace: `com.sesap.contract@1.0.0`
- Main concept must have `@template` decorator
- Fields: `o String fieldName`, `o String fieldName optional`
- Arrays (`o String[] items`) only at the `@template` concept level
- Nested concepts must NOT contain arrays — use comma-separated strings
- Every JSON object needs `"$class": "com.sesap.contract@1.0.0.TypeName"`

### TemplateMark Rules

- Simple variables: `{{variableName}}`
- Nested concepts: `{{#clause conceptName}} ... {{/clause}}`
- String arrays: `{{#join arrayName}}` (inline, NO closing tag)
- NO `{{#if}}`, `{{#optional}}`, `{{#template}}`, `{{.}}`, `{{/join}}`

## File Reference

### Backend

| File                                       | Purpose                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `server/api.ts`                            | Express API, `/api/generate/contract`, `stripNullValues()`         |
| `server/scripts/transcript-to-contract.ts` | 3-step LLM pipeline                                                |
| `server/llm/azure-client.ts`               | Azure OpenAI client with retry/tiers                               |
| `server/schemas/contract.ts`               | Zod schemas (ContractStructure, AccordArtifacts, ValidationResult) |
| `server/accord/engine.ts`                  | Server-side Accord rendering                                       |

### Frontend

| File                                  | Purpose                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `src/store/store.ts`                  | Zustand store, `rebuild()`, state management          |
| `src/App.tsx`                         | App init, routing, theme                              |
| `src/main.tsx`                        | Entry point, Monaco config, console noise suppression |
| `src/components/TranscriptUpload.tsx` | Transcript upload modal                               |
| `src/components/Navbar.tsx`           | Nav bar, theme toggle                                 |
| `src/components/ProblemPanel.tsx`     | Error display                                         |
| `src/editors/ConcertoEditor.tsx`      | CTO editor                                            |
| `src/editors/MarkdownEditor.tsx`      | TemplateMark editor                                   |
| `src/editors/JSONEditor.tsx`          | JSON data editor                                      |

### Config

| File                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `vite.config.ts`       | Build config, Node polyfills, Accord aliases, API proxy |
| `tsconfig.json`        | Frontend TS config                                      |
| `server/tsconfig.json` | Server TS config                                        |
| `package.json`         | Dependencies, scripts, `concerto-core` override         |

## Rules

- **Optimize existing code** before adding new code. This is a mature project with bugs from agents adding too much.
- **Single responsibility.** Each function does one thing.
- **Follow existing patterns.** Search the codebase to understand how things are done before proposing changes.
- **Use the logger/console.log** at critical nodes. No `print()`.
- **Use web search and Context7** (library docs MCP) when in doubt. Never guess about Accord, Zod, or OpenAI SDK behavior.
- **User may use voice transcription** — infer intent from context if wording is imprecise.
- **Use high reasoning effort.** Be a senior developer. Ground yourself in the code.
- **ASCII diagrams** for every implementation plan — dependency graph, data flow, state transitions.
- **Don't create report files.** Keep all analysis and reports in chat.
- **Use `mongodb` MCP tool** when working with the database.
