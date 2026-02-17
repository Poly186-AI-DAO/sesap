---
applyTo: "**"
---

# SESAP Troubleshooting Instructions

## Active Competition

**Agents League — Creative Apps Track** — Deadline: March 1, 2026. Strategy: `docs/AGENTS_LEAGUE_STRATEGY.md`

- Reliability & Safety is 20% of the judging rubric — fix bugs thoroughly, don't patch over them
- Every fix must be production-quality and open-source ready
- Document any solutions to tricky problems for the COPILOT_USAGE.md (shows reasoning depth)

## Project Context

SESAP (Self-Executing Social Agreements Platform) is a decentralized application by Poly186 for creating and executing Smart Social Contracts (SSCs) using AI and the Accord Project stack. The current MVP is a Template Playground for designing, testing, and generating SSCs from meeting transcripts.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SESAP ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Frontend - Vite/React 18]  ---proxy /api/*--> [Express API]   │
│   ├── Zustand Store (state)                      port 3001      │
│   ├── Monaco Editors (CTO, TEM.MD, JSON)              │         │
│   ├── Ant Design UI                                   │         │
│   ├── Accord Template Engine (browser)                │         │
│   └── React Router (SPA)                              │         │
│                                                       ▼         │
│                                              <Azure AI Foundry> │
│                                               GPT-5.1 (heavy)   │
│                                               GPT-5-mini (med)   │
│                                               GPT-5-nano (light) │
│                                                       │         │
│                                                       ▼         │
│                                              [Accord Engine]    │
│                                               Concerto Models   │
│                                               TemplateMark      │
│                                               CiceroMark→HTML   │
│                                                                  │
│  (DB) PostgreSQL ← WIP, not yet integrated                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Data Flow: Transcript → Contract

```
Transcript.txt
    │
    ▼
[Step 1: GPT-5.1 (heavy)] ──Zod ContractStructureSchema──▶ structure.json
    │
    ▼
[Step 2: GPT-5-mini (medium)] ──Zod AccordArtifactsSchema──▶ model.cto + template.tem.md + data.json
    │
    ▼
[Step 3: GPT-5-mini (validation)] ──Zod ValidationResultSchema──▶ polished artifacts
    │
    ▼
[Accord Engine] ──ModelManager + TemplateMarkInterpreter──▶ agreement HTML
```

### State Management Flow (Zustand)

```
[User edits editor] → setEditorValue / setEditorModelCto / setEditorAgreementData
                              │
                              ▼ (on apply/save)
                      setTemplateMarkdown / setModelCto / setData
                              │
                              ▼
                      rebuildDeBounce(template, model, data) ← 500ms debounce
                              │
                              ▼
                      ModelManager → TemplateMarkInterpreter → CiceroMark → HTML
                              │
                              ▼
                      set({ agreementHtml, error })
```

## Tech Stack Reference

| Layer             | Technology       | Version                                                     | Notes                              |
| ----------------- | ---------------- | ----------------------------------------------------------- | ---------------------------------- |
| Frontend          | React            | 18.x                                                        | SPA with React Router              |
| Build             | Vite             | 4.x                                                         | Node polyfills required for Accord |
| State             | Zustand          | 4.x                                                         | With immer + devtools middleware   |
| UI                | Ant Design       | 5.x                                                         | With styled-components             |
| Editors           | Monaco           | 0.50.x                                                      | CDN-loaded, CTO/MD/JSON            |
| Contract Engine   | Accord Project   | 0.24.x (Cicero), 3.20.x (Concerto), 2.3.x (template-engine) | Browser + server                   |
| LLM SDK           | OpenAI           | 6.x                                                         | Zod 4 compatible                   |
| Schema Validation | Zod              | 4.x                                                         | Structured output for LLM          |
| LLM Provider      | Azure AI Foundry | —                                                           | GPT-5.1, GPT-5-mini, GPT-5-nano    |
| Backend           | Express          | 5.x                                                         | API server port 3001               |
| Testing           | Vitest           | 1.x                                                         | jsdom + React Testing Library      |

## Key Files to Inspect by Category

### Backend Pipeline

- `server/api.ts` — Express API, `/api/generate/contract` endpoint, `stripNullValues()`
- `server/scripts/transcript-to-contract.ts` — 3-step LLM pipeline with prompt engineering
- `server/llm/azure-client.ts` — Azure OpenAI client, retry logic, `chat()` + `chatStructured()`
- `server/schemas/contract.ts` — Zod schemas for structured output (nullable rules, no z.record)
- `server/accord/engine.ts` — Server-side Accord rendering (Concerto → TemplateMark → HTML)

### Frontend State & Components

- `src/store/store.ts` — Zustand: `rebuild()`, `setContractArtifacts()`, `loadFromLink()`, debounce logic
- `src/App.tsx` — Init flow, StrictMode double-mount guard, theme management
- `src/components/TranscriptUpload.tsx` — Modal for transcript → contract generation via API
- `src/components/Navbar.tsx` — Navigation, theme toggle, share link
- `src/components/ProblemPanel.tsx` — Error display panel

### Editors

- `src/editors/ConcertoEditor.tsx` — Concerto model (.cto) editor
- `src/editors/MarkdownEditor.tsx` — TemplateMark (.tem.md) editor
- `src/editors/JSONEditor.tsx` — JSON data editor
- `src/editors/editorsContainer/` — Editor layout and container

### Config

- `vite.config.ts` — Node polyfills, Accord aliases, proxy to API server
- `tsconfig.json` — Frontend TypeScript config (bundler mode)
- `server/tsconfig.json` — Server TypeScript config (CommonJS)
- `package.json` — Dependencies, scripts, concerto-core override

### Documentation

- `docs/STRUCTURED_OUTPUT_LESSONS.md` — Known LLM structured output pitfalls
- `docs/WIP_MCP_STATUS.md` — Current pipeline status and architecture
- `docs/SCRIPTS.md` — How to run scripts, test flows
- `docs/IMPLEMENTATION.md` — Future MVP implementation plan

## Troubleshooting Protocol

**YOU MAY NOT CHANGE CODE UNTIL YOU HAVE REVIEWED EVERY RELEVANT FILE AND THE USER APPROVES YOUR ANALYSIS.**

### Step 1: Identify the Problem Domain

Ask: **Is it a data problem or a code logic problem?**

| Domain                | Common Issues                                                 | Files to Check First                                                     |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| LLM Output            | Wrong schema, null values, missing $class, truncated output   | `server/schemas/contract.ts`, `server/scripts/transcript-to-contract.ts` |
| Accord Engine         | Template/model variable mismatch, $class errors, array syntax | `server/accord/engine.ts`, `src/store/store.ts` (rebuild fn)             |
| State Management      | Race conditions, stale state, debounce cancelation            | `src/store/store.ts`, `src/App.tsx`                                      |
| API Layer             | CORS, proxy config, request/response shape mismatch           | `server/api.ts`, `vite.config.ts`                                        |
| Zod/Structured Output | .optional() vs .nullable(), z.record() errors                 | `server/schemas/contract.ts`, `docs/STRUCTURED_OUTPUT_LESSONS.md`        |
| Build/Bundle          | Node polyfill errors, Accord import failures                  | `vite.config.ts`, `package.json`                                         |

### Step 2: Investigate Thoroughly

- Open EVERY relevant file. Do NOT ask permission — you have the tools, use them.
- Search the codebase, form a hypothesis, search again to verify. Be Sherlock Holmes.
- Build ASCII diagrams of the dependency graph, data flow, and state transitions for the specific issue.
- Quote any logs provided and trace them back to the exact line of code.
- Check `docs/STRUCTURED_OUTPUT_LESSONS.md` for known LLM structured output pitfalls.
- Use web search and Context7 (library docs MCP) for Accord Project, Zod, OpenAI SDK docs.

### Step 3: Report (In Chat Only)

1. Restate the problem in your own words
2. ASCII dependency/data-flow diagram for the affected area
3. List of bugs found during investigation
4. Root cause analysis — data problem vs logic problem
5. Simple, straightforward fix plan (favor simplicity)

**DO NOT create report files or documents. Keep everything in chat.**

## SESAP-Specific Gotchas

1. **$class requirement**: Every JSON object for Concerto MUST have `"$class": "com.sesap.contract@1.0.0.TypeName"`. Omitting this causes silent failures.
2. **Null vs Omit**: Concerto expects optional fields to be OMITTED, not null. `stripNullValues()` in `server/api.ts` handles this — verify it's being called.
3. **Zod 4 + OpenAI SDK 6**: Must use SDK 6.x for Zod 4 compatibility. SDK 5.x breaks.
4. **`.optional()` is illegal in structured output**: Use `.nullable()`. See `docs/STRUCTURED_OUTPUT_LESSONS.md`.
5. **`z.record()` is illegal in structured output**: Use `z.string()` and parse after receiving.
6. **Reasoning model token budget**: GPT-5.1 uses 50-80% of tokens for reasoning. Need 4K output? Request 16K+.
7. **Hardcoded money model**: Both `server/accord/engine.ts` and `src/store/store.ts` hardcode `org.accordproject.money@0.3.0`. If one is updated, BOTH must be.
8. **Debounce race conditions**: `rebuild()` is debounced at 500ms. Previous promises resolve as cancelations.
9. **StrictMode double-mount**: `App.tsx` uses `initCalledRef` guard. Removing it causes double init.
10. **Console noise suppression**: `main.tsx` suppresses CDN 404s, ResizeObserver errors. Real errors may hide if they match patterns.
11. **Vite proxy**: `/api/*` proxies to `localhost:3001`. Express server must be running for contract generation.
12. **Concerto-core override**: `package.json` overrides to `^3.20.4`. Removing this breaks Accord imports.
13. **TemplateMark syntax**: No `{{#if}}`, no `{{#optional}}`, no `{{.}}`, no `{{/join}}` closing tags. `{{#join arrayName}}` is inline with NO closing tag for String[] arrays.
14. **Flat model structure**: Arrays only at the @template concept level. Nested concepts must NOT contain arrays — use comma-separated strings instead.

## Rules

- Use web search and Context7 (library docs MCP) when in doubt. DO NOT GUESS.
- Produce ASCII logic diagrams for every troubleshooting session.
- All reports stay in chat. DO NOT create files unless explicitly asked.
- Follow `Implementation.instructions.md` when proposing fixes.
- The user may use voice transcription — infer intent from context if wording is imprecise.
- Use high reasoning effort. Be a senior developer. Be diligent. Ground yourself in the code.
- Do NOT ask "can I look at the next file?" — just look at it. You have the tools.
- Gather evidence, refine hypothesis, search again, think again. Don't stop at first guess.
