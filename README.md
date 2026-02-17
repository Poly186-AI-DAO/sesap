<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-4-646cff?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Accord%20Project-Template%20Engine-orange" alt="Accord Project" />
  <img src="https://img.shields.io/badge/Azure%20AI%20Foundry-GPT--5-0078d4?logo=microsoftazure&logoColor=white" alt="Azure AI" />
  <img src="https://img.shields.io/badge/MCP-Server-green" alt="MCP Server" />
  <img src="https://img.shields.io/badge/License-Apache%202.0-brightgreen" alt="License" />
</p>

# SESAP — Self-Executing Social Agreements Platform

**Turn meeting transcripts into executable smart contracts in seconds.**

SESAP is an AI-powered platform that transforms unstructured meeting transcripts into structured, executable [Smart Social Contracts](docs/Smart%20Social%20Contracts%20Overview.md) using the [Accord Project](https://accordproject.org/) technology stack. It features a browser-based Template Playground for designing, testing, and previewing contracts in real-time — and an MCP server that brings contract generation directly into GitHub Copilot Chat.

---

## How It Works

```
┌──────────────────┐     ┌────────────────────┐     ┌────────────────────┐     ┌──────────────┐
│  Meeting          │     │  Step 1: GPT-5.1   │     │  Step 2: GPT-5-mini│     │  Step 3:     │
│  Transcript       │────▶│  Extract structure  │────▶│  Generate Accord   │────▶│  Validate &  │
│  (plain text)     │     │  (parties, scope,   │     │  artifacts (model, │     │  polish      │
│                   │     │   timeline, terms)  │     │  template, data)   │     │  artifacts   │
└──────────────────┘     └────────────────────┘     └────────────────────┘     └──────┬───────┘
                                                                                       │
                                                                                       ▼
                          ┌──────────────────────────────────────────────────────────────┐
                          │  Accord Engine: Concerto Model + TemplateMark → HTML Preview │
                          └──────────────────────────────────────────────────────────────┘
```

1. **Paste a transcript** — Upload or paste a meeting transcript
2. **AI extracts & generates** — A 3-step GPT pipeline extracts contract structure, generates Accord Project artifacts (Concerto model, TemplateMark template, JSON data), and validates them
3. **Edit & preview** — Use Monaco editors to refine the model, template, and data. See the rendered HTML agreement update in real-time

---

## Features

- **AI Contract Generation** — 3-step LLM pipeline (GPT-5.1 → GPT-5-mini → GPT-5-mini) with Zod-validated structured output
- **Template Playground** — Browser-based editors for Concerto models (.cto), TemplateMark templates (.tem.md), and JSON data
- **Real-time Preview** — Instant HTML agreement rendering via the Accord Project engine
- **MCP Server** — Use SESAP tools directly in GitHub Copilot Chat (generate, render, validate contracts)
- **Share Links** — Compress and share contract configurations via URL
- **Dark/Light Theme** — Full theme support with persistence

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        SESAP Architecture                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend (Vite 4 / React 18)          Backend (Express 5)       │
│  ├── Zustand (state management)        ├── POST /api/generate    │
│  ├── Monaco Editor (CTO, MD, JSON)     ├── Azure AI Foundry      │
│  ├── Ant Design 5 (UI components)      │   ├── GPT-5.1 (heavy)   │
│  ├── Accord Engine (browser-side)      │   ├── GPT-5-mini (med)  │
│  └── React Router (SPA)               │   └── GPT-5-nano (light) │
│                                        ├── Accord Engine (server) │
│         proxy /api/* ──────────────▶   └── Zod 4 (schemas)       │
│                                                                  │
│  MCP Server (stdio)                                              │
│  ├── generate_contract  (transcript → artifacts + HTML)          │
│  ├── render_contract    (model + template + data → HTML)         │
│  └── validate_contract  (model + template + data → errors)       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 6
- **Azure AI Foundry** account (for AI contract generation)

### 1. Clone & Install

```bash
git clone https://github.com/Poly186-AI-DAO/sesap.git
cd sesap
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Azure AI Foundry credentials:

```env
AZURE_AI_FOUNDRY_BASE_URL=https://your-resource.cognitiveservices.azure.com
AZURE_AI_FOUNDRY_KEY=your-api-key
AZURE_GPT_5_1_DEPLOYMENT=gpt-5.1
AZURE_GPT_5_MINI_DEPLOYMENT=gpt-5-mini
AZURE_GPT_5_NANO_DEPLOYMENT=gpt-5-nano
```

### 3. Run

**Template Playground** (no API key needed for manual editing):

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

**With AI Contract Generation** (requires Azure credentials):

```bash
# Terminal 1: Start the API server
npm run server

# Terminal 2: Start the frontend
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

---

## MCP Server — Use SESAP in GitHub Copilot

SESAP includes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that integrates directly with GitHub Copilot Chat in VS Code.

### Setup

Add to your `.vscode/mcp.json` (already configured in this repo):

```json
{
  "servers": {
    "sesap": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "server/mcp/index.ts"],
      "env": {
        "AZURE_AI_FOUNDRY_BASE_URL": "${env:AZURE_AI_FOUNDRY_BASE_URL}",
        "AZURE_AI_FOUNDRY_KEY": "${env:AZURE_AI_FOUNDRY_KEY}",
        "AZURE_GPT_5_1_DEPLOYMENT": "${env:AZURE_GPT_5_1_DEPLOYMENT}",
        "AZURE_GPT_5_MINI_DEPLOYMENT": "${env:AZURE_GPT_5_MINI_DEPLOYMENT}",
        "AZURE_GPT_5_NANO_DEPLOYMENT": "${env:AZURE_GPT_5_NANO_DEPLOYMENT}"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `generate_contract` | Transcript → full pipeline → Accord artifacts + HTML |
| `render_contract` | Model + template + data → rendered HTML |
| `validate_contract` | Model + template + data → validation result with errors |

### Available Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Sample Template | `sesap://samples` | Playground sample with Concerto model and TemplateMark |
| Platform Info | `sesap://info` | SESAP capabilities and pipeline description |

### Example Usage in Copilot Chat

```
@workspace Use the SESAP render_contract tool to render this template
with the sample data from sesap://samples
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 18.x / 5.x |
| Build | Vite | 4.x |
| State | Zustand (immer + devtools) | 4.x |
| UI | Ant Design + styled-components | 5.x |
| Editors | Monaco Editor | 0.50.x (CDN) |
| Contract Engine | Accord Project (Concerto, TemplateMark, CiceroMark) | 3.20.x / 2.3.x |
| LLM | Azure AI Foundry via OpenAI SDK | 6.x |
| Schema Validation | Zod | 4.x |
| Backend | Express | 5.x |
| MCP | @modelcontextprotocol/sdk | 1.x |
| Testing | Vitest + React Testing Library | 1.x |

---

## Project Structure

```
sesap/
├── src/                          # Frontend source
│   ├── App.tsx                   # App initialization and routing
│   ├── main.tsx                  # Entry point, Monaco config
│   ├── store/store.ts            # Zustand state management + Accord rebuild
│   ├── editors/                  # Monaco editor components (CTO, MD, JSON)
│   ├── components/               # UI components (Navbar, TranscriptUpload, etc.)
│   ├── samples/                  # Playground sample data
│   └── tests/                    # Unit tests (Vitest)
├── server/                       # Backend source
│   ├── api.ts                    # Express API server (port 3001)
│   ├── accord/engine.ts          # Server-side Accord rendering
│   ├── llm/azure-client.ts       # Azure OpenAI client with retry logic
│   ├── schemas/contract.ts       # Zod schemas for structured LLM output
│   ├── scripts/                  # 3-step LLM pipeline
│   └── mcp/                      # MCP server (stdio transport)
│       ├── index.ts              # Entry point
│       ├── tools.ts              # Contract tools (generate, render, validate)
│       └── resources.ts          # Resources (samples, platform info)
├── docs/                         # Documentation
├── .env.example                  # Environment variable template
└── .vscode/mcp.json              # MCP server configuration
```

---

## Testing

```bash
npm test
```

Runs 53 unit tests covering:
- Zod schema validation (all contract schemas)
- `stripNullValues` utility (Concerto compatibility)
- Store utility functions (error formatting, theme, debounce cancelation)
- UI components (Navbar rendering)
- Compression utilities (share link encoding/decoding)

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite dev server |
| `server` | `npm run server` | Start Express API server |
| `mcp` | `npm run mcp` | Start MCP server (stdio) |
| `build` | `npm run build` | Production build |
| `test` | `npm test` | Run unit tests |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to SESAP.

## License

[Apache License 2.0](LICENSE) — Copyright © 2024-2026 [Poly186](https://poly186.io)

---

<p align="center">
Built with the <a href="https://accordproject.org/">Accord Project</a> and <a href="https://azure.microsoft.com/en-us/products/ai-services">Azure AI Foundry</a>
</p>
