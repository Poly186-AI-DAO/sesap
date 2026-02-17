# SESAP × Agents League: Creative Apps Track Strategy

> **Track**: 🎨 Creative Apps (GitHub Copilot)
> **Deadline**: March 1, 2026 (11:59 PM PT)
> **Prize**: $500 + GitHub Copilot Pro (Community Favorite / Product Team Pick)
> **Status**: Active — competition runs Feb 16–27, submission by Mar 1

---

## 1. Why Creative Apps Track?

SESAP is a **content generation tool** — it transforms meeting transcripts into legally-structured smart contracts using AI. This maps directly to the Creative Apps track's "Content Generation" and "Creative Productivity" categories:

> "Build applications that create, transform, or enhance creative content"
> "Transform existing content into new formats, styles, or mediums"

No scenario lock. No tech stack restrictions. Any creative application works.

---

## 2. What SESAP Already Has vs. What's Needed

### ✅ Already Competition-Ready

| Requirement | SESAP Status |
|---|---|
| Creative AI application | ✅ Transcript → Smart Contract is genuinely novel |
| Polished UX | ✅ Monaco editors, Ant Design, real-time preview |
| Multi-step reasoning | ✅ 3-step LLM pipeline (structure → artifacts → validation) |
| Reliability & safety | ✅ Zod structured output, retry logic, null-stripping |
| Azure AI integration | ✅ GPT-5.1 + GPT-5-mini via Azure AI Foundry |
| Works end-to-end | ✅ Paste transcript → get contract files + HTML preview |
| Apache 2.0 license | ✅ Already in place |

### ⬜ Needs Work

| Requirement | Status | Priority | Effort |
|---|---|---|---|
| **Document GitHub Copilot usage** | Missing | REQUIRED | Low (2h) |
| **Competition-grade README** | Current README is minimal | REQUIRED | Medium (3h) |
| **.env.example file** | Missing | REQUIRED | Low (15m) |
| **Demo video** | Missing | REQUIRED | Medium (2h) |
| **Remove dead code & empty dirs** | Cleanup needed | High | Low (1h) |
| **Sanitize git history** | No secrets in code, but audit needed | High | Low (30m) |
| **MCP Server for Copilot** | Not built | HIGH VALUE (bonus) | Medium (6-8h) |
| **Improve test coverage** | Only 2 test files | Medium | Medium (4h) |
| **Fix build warnings** | Not audited yet | Medium | Low (1h) |

---

## 3. Evaluation Rubric — How We Score

```
┌────────────────────────────────────────────────────────────────────────────┐
│  RUBRIC                                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Accuracy & Relevance (20%)         ← Meets track requirements             │
│  ├── Creative app? ✅                                                      │
│  ├── GitHub Copilot usage documented? ⬜ NEED                              │
│  └── Public repo with README? ⬜ NEED                                      │
│                                                                            │
│  Reasoning & Multi-step Thinking (20%)  ← Clear problem-solving approach   │
│  ├── 3-step LLM pipeline ✅                                                │
│  ├── Structured output with Zod ✅                                         │
│  └── Validation + polishing step ✅                                        │
│                                                                            │
│  Creativity & Originality (15%)     ← Novel ideas, unexpected execution    │
│  ├── "Meeting transcript → Smart Contract" is unique ✅                    │
│  ├── Accord Project integration is uncommon ✅                             │
│  └── MCP server for Copilot = differentiation point ⬜ BONUS               │
│                                                                            │
│  User Experience & Presentation (15%) ← Clear, polished, demoable          │
│  ├── Monaco editors with syntax highlighting ✅                            │
│  ├── Real-time agreement preview ✅                                        │
│  ├── Demo video ⬜ NEED                                                    │
│  └── Clean README with screenshots ⬜ NEED                                 │
│                                                                            │
│  Reliability & Safety (20%)         ← Solid patterns, no pitfalls          │
│  ├── Zod schema validation ✅                                              │
│  ├── Retry logic on LLM calls ✅                                           │
│  ├── No hardcoded secrets ✅                                               │
│  ├── .env.example provided ⬜ NEED                                         │
│  └── Error handling in UI (ProblemPanel) ✅                                │
│                                                                            │
│  Community Vote (10%)               ← Discord engagement                   │
│  └── Share project, engage in Discord ⬜ NEED                              │
│                                                                            │
│  BONUS: Fan Favorite (+10)                                                 │
│  BONUS: Product Team Pick (+10)                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. The Winning Strategy

### 4.1 Core Narrative

**"SESAP transforms meeting conversations into legally-structured smart contracts using a 3-step AI reasoning pipeline and the Accord Project standard."**

This is novel because:
- Nobody else is doing transcript → contract with Accord Project
- The multi-step pipeline (structure extraction → artifact generation → validation) shows genuine reasoning
- The Concerto model + TemplateMark template + JSON data triplet is a sophisticated output format
- Real-time browser-based rendering via Accord engine is impressive

### 4.2 The MCP Server Differentiator

Build an MCP server that exposes SESAP's contract generation as a tool for GitHub Copilot in VS Code:

```
┌──────────────────────────────────────────────────────────────────┐
│  Developer in VS Code                                             │
│  ├── Copilot Chat: "Generate a contract from this transcript"     │
│  │         │                                                      │
│  │         ▼                                                      │
│  │   [SESAP MCP Server]                                          │
│  │   ├── Tool: generate_contract(transcript) → artifacts          │
│  │   ├── Tool: validate_contract(model, template, data) → errors │
│  │   ├── Tool: render_contract(model, template, data) → HTML     │
│  │   └── Resource: list_templates() → available templates         │
│  │         │                                                      │
│  │         ▼                                                      │
│  │   Returns structured contract files                            │
│  │   Opens in SESAP playground for preview/editing                │
│  └────────────────────────────────────────────────────────────────│
└──────────────────────────────────────────────────────────────────┘
```

Why this wins:
- The starter kit EXPLICITLY says: *"Consider building MCP servers that integrate directly with GitHub Copilot in VS Code!"*
- It shows we understand the GitHub Copilot ecosystem deeply
- It makes SESAP useful to developers right in their IDE
- It's creative and unexpected (nobody submitting to Creative Apps will have an MCP server for contract generation)

### 4.3 GitHub Copilot Usage Documentation

Document how Copilot was used throughout development. Create a `COPILOT_USAGE.md`:
- Screenshots of Copilot Chat conversations during refactoring
- Examples of Copilot-generated code (Zod schemas, Accord engine, React components)
- How Copilot Agent mode was used for multi-file changes
- Prompting patterns used for the MCP server implementation

---

## 5. Implementation Roadmap

### Phase 1: Clean & Sanitize (Day 1 — ~3 hours)

```
Priority: REQUIRED — must be done before anything else
```

- [ ] Create `.env.example` with all required env vars (no values)
- [ ] Delete empty directories: `src/content/`, `src/types/components/`, `src/constants/learningSteps/`, `src/tests/store/`, `src/tests/components/__snapshots__/`
- [ ] Remove or populate `src/constants/content/footer.json` if unused
- [ ] Audit `src/accord-test/` — is this needed in the repo? Move to `.gitignore` or remove
- [ ] Remove `build_log.txt` and `build_log_2.txt` from repo
- [ ] Clean up `public/` assets — remove Accord Project logos if they're not CC-licensed for redistribution
- [ ] Verify `.gitignore` covers all sensitive files
- [ ] Run `npm audit` and fix any security vulnerabilities
- [ ] Fix any TypeScript errors (`npm run build`)
- [ ] Verify the app runs end-to-end: start backend → upload transcript → get contract

### Phase 2: Code Quality & Testing (Day 1-2 — ~4 hours)

```
Priority: HIGH — directly affects Reliability & Safety (20%)
```

- [ ] Add meaningful tests for the LLM pipeline (mock Azure calls, test Zod schema validation)
- [ ] Add tests for the Accord engine (model parsing, template rendering)
- [ ] Add tests for the Zustand store (rebuild, setContractArtifacts, loadFromLink)
- [ ] Fix any lint warnings
- [ ] Add proper error boundaries to React components
- [ ] Review and clean up console.log statements (keep critical ones, remove noise)

### Phase 3: MCP Server (Day 2-4 — ~8 hours)

```
Priority: HIGH VALUE — biggest differentiation point
```

- [ ] Scaffold MCP server using `@modelcontextprotocol/sdk`
- [ ] Implement `generate_contract` tool (transcript → contract artifacts)
- [ ] Implement `validate_contract` tool (artifacts → validation errors)
- [ ] Implement `render_contract` tool (artifacts → HTML agreement)
- [ ] Implement `list_templates` resource (available sample templates)
- [ ] Add `.vscode/mcp.json` for easy Copilot integration
- [ ] Test with GitHub Copilot Chat in VS Code
- [ ] Document MCP server setup in README

### Phase 4: README & Documentation (Day 4-5 — ~4 hours)

```
Priority: REQUIRED — directly affects UX & Presentation (15%) + Accuracy (20%)
```

- [ ] Rewrite README.md:
  - Hero section with project name, tagline, badges
  - Architecture diagram (Mermaid or ASCII)
  - Screenshots/GIFs of the playground
  - Quick start (clone → install → configure → run)
  - How it works (3-step pipeline explanation)
  - MCP server usage with GitHub Copilot
  - Tech stack table
  - Contributing guidelines
  - License
- [ ] Create `COPILOT_USAGE.md` documenting GitHub Copilot usage throughout development
- [ ] Update `CONTRIBUTING.md` and `DEVELOPERS.md` for open-source audience
- [ ] Clean up `/docs` — remove internal-only docs or redact sensitive content

### Phase 5: Demo Video (Day 5 — ~2 hours)

```
Priority: REQUIRED — submission requires demo materials
```

- [ ] Script the demo flow:
  1. Show the problem: "Meetings create agreements, but they're unstructured"
  2. Paste a transcript into SESAP
  3. Watch the 3-step pipeline generate contract files
  4. Edit in Monaco editors (CTO model, TemplateMark, JSON data)
  5. See real-time HTML agreement preview
  6. Demo the MCP server: use Copilot Chat to generate a contract from VS Code
  7. Show the architecture briefly
- [ ] Record with screen + voiceover (2-3 minutes)
- [ ] Upload to YouTube (unlisted or public)

### Phase 6: Submission (Day 5-6)

```
Priority: REQUIRED — deadline March 1
```

- [ ] Fill out submission form on GitHub Issues
  - Track: Creative Apps (GitHub Copilot)
  - Project Name: SESAP — Self-Executing Social Agreements Platform
  - Repository URL: https://github.com/Poly186-AI-DAO/sesap
  - Description (250 words max)
  - Demo video link
  - Tech stack: TypeScript/JavaScript
  - Key technologies: Azure AI Foundry, React, Vite, Zustand, Monaco Editor, Accord Project, Zod, MCP Server
  - Individual submission
  - Technical highlights
  - Challenges & learnings
- [ ] Share project on Discord (#creative-apps channel)
- [ ] Engage with community for Fan Favorite vote

---

## 6. Codebase Audit Results

### What's Clean
- ✅ No secrets in source code (all in `.env`, which is gitignored)
- ✅ Apache 2.0 license in place
- ✅ Core functionality works (transcript → contract pipeline)
- ✅ Clean git history (no secrets ever committed to source files)
- ✅ Express API properly structured
- ✅ Zustand store well-organized with immer + devtools

### What Needs Cleanup
- ⚠️ Empty directories: `src/content/`, `src/types/components/`, `src/constants/learningSteps/`, `src/tests/store/`, `src/tests/components/__snapshots__/`
- ⚠️ `build_log.txt` and `build_log_2.txt` in repo root (remove)
- ⚠️ `src/accord-test/` has test fixtures that may not be needed in production
- ⚠️ Only 2 test files (Navbar.test.tsx, Compression.test.tsx) — weak coverage
- ⚠️ `src/constants/content/footer.json` — check if used
- ⚠️ Missing `.env.example`
- ⚠️ README is minimal developer README, not competition-grade
- ⚠️ Several internal docs in `/docs` reference "Internal" in filenames

### Code Stats
- ~3,072 lines of TypeScript/TSX across `src/` and `server/`
- 10 commits on main branch
- Apache 2.0 license
- React 18 + Vite 4 + Express 5

---

## 7. Submission Draft

### Project Description (250 words)

**SESAP (Self-Executing Social Agreements Platform)** transforms meeting transcripts into legally-structured smart contracts using a multi-step AI reasoning pipeline.

The challenge: every meeting produces agreements, but they remain trapped in unstructured notes. SESAP solves this by applying a 3-step AI pipeline powered by Azure AI Foundry:

1. **Structure Extraction** (GPT-5.1) — Analyzes the transcript to identify parties, obligations, timelines, and contract structure
2. **Artifact Generation** (GPT-5-mini) — Generates Accord Project-compatible contract files: a Concerto data model (.cto), TemplateMark template (.tem.md), and JSON agreement data
3. **Validation & Polish** (GPT-5-mini) — Cross-validates all artifacts for consistency and Accord engine compatibility

The generated contract is rendered in a browser-based playground featuring Monaco editors for each artifact type and a real-time HTML agreement preview powered by the Accord Project engine.

SESAP also includes an MCP server that integrates directly with GitHub Copilot in VS Code, enabling developers to generate, validate, and render smart contracts through natural language chat — bringing contract intelligence right into the development workflow.

Built with React, Vite, Zustand, Ant Design, Express, and Zod structured output for type-safe LLM interactions. GitHub Copilot was used extensively throughout development for refactoring, debugging, and implementing the MCP server integration.

**Key innovation**: Combining meeting intelligence (transcript understanding) with legal technology (Accord Project standards) through structured AI reasoning — making smart contracts accessible to anyone who can have a conversation.

### Technical Highlights

- 3-step cascading LLM pipeline with structured output (Zod 4 + OpenAI SDK 6)
- Browser-based Accord Project engine (Concerto models + TemplateMark + CiceroMark → HTML)
- MCP server exposing contract generation as tools for GitHub Copilot
- Real-time contract preview with Monaco editors
- Tiered model strategy (heavy/medium/light) for cost-efficient reasoning

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MCP server bugs during demo | Medium | High | Test thoroughly, have fallback demo without MCP |
| Azure API rate limits during demo | Low | High | Pre-record the LLM pipeline portion of demo |
| Judges unfamiliar with Accord Project | High | Medium | Explain clearly in README + demo video |
| Low community engagement | Medium | Medium | Post early, engage in Discord, help others |
| Build/deploy issues for evaluators | Medium | High | Perfect the README setup instructions, test on clean machine |

---

## 9. Timeline

```
Feb 16 (Today)  ─── Create strategy doc ✅
                    Register for competition ✅
Feb 17          ─── Phase 1: Clean & sanitize
Feb 18          ─── Phase 2: Code quality + tests
Feb 19-21       ─── Phase 3: MCP server implementation
Feb 22-23       ─── Phase 4: README + documentation
Feb 24          ─── Phase 5: Demo video
Feb 25-26       ─── Polish, test on clean machine, fix issues
Feb 27          ─── Final review
Mar 1           ─── SUBMIT (deadline 11:59 PM PT)
```

---

## 10. Quick Reference — Submission Checklist

- [ ] Public GitHub repo
- [ ] Comprehensive README.md with setup instructions
- [ ] No hardcoded API keys or secrets
- [ ] .env.example provided
- [ ] Demo video (YouTube link)
- [ ] GitHub Copilot usage documented (COPILOT_USAGE.md)
- [ ] MCP server for Copilot integration (bonus)
- [ ] Code of Conduct acknowledged
- [ ] Disclaimer read and agreed to
- [ ] All content is original work with proper attribution
