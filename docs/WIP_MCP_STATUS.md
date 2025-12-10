# SESAP MCP - Work In Progress

> **Last Updated**: 2024-12-10
> **Status**: 🔴 Planning Phase

---

## Goals

1. **Simple API** - "Hey, make me a social contract for [situation]"
2. **MCP-first** - Expose contract generation as MCP tools for LLM agents
3. **Azure OpenAI** - Use gpt-5-mini, gpt-5-nano, gpt-5.1 deployments
4. **PostgreSQL** - Persist contracts and track execution
5. **Frontend** - Keep current Vite playground as user-facing UI

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SESAP (Current State)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌──────────────────────────────────┐   │
│  │   Vite UI   │────▶│   Accord Project (browser-side)   │   │
│  │  (React)    │     │ - ModelManager                    │   │
│  └─────────────┘     │ - TemplateMarkInterpreter         │   │
│                      │ - transform() -> HTML              │   │
│                      └──────────────────────────────────┘   │
│                                                              │
│  ❌ No MCP Server                                            │
│  ❌ No Persistence (PostgreSQL ready but not connected)      │
│  ❌ No Contract Execution Tracking                           │
│  ❌ Browser-side API keys (insecure)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SESAP (Target State)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌──────────────────────────────────┐   │
│  │   Vite UI   │────▶│         MCP Server (Node.js)      │   │
│  │  (React)    │     │                                    │   │
│  └─────────────┘     │  Tools:                            │   │
│                      │  - create_contract(description)    │   │
│  ┌─────────────┐     │  - get_contract(id)                │   │
│  │ MCP Clients │────▶│  - validate_contract(id)           │   │
│  │ (Claude,etc)│     │  - list_contracts(filters)         │   │
│  └─────────────┘     │                                    │   │
│                      └───────────────┬──────────────────┘   │
│                                      │                       │
│                      ┌───────────────▼──────────────────┐   │
│                      │         Azure OpenAI              │   │
│                      │  gpt-5-mini / gpt-5-nano          │   │
│                      └───────────────┬──────────────────┘   │
│                                      │                       │
│                      ┌───────────────▼──────────────────┐   │
│                      │         PostgreSQL                 │   │
│                      │  - contracts table                 │   │
│                      │  - parties table                   │   │
│                      │  - signatures table                │   │
│                      └──────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## MCP Tools (Simplified)

| Tool | Description | Input |
|------|-------------|-------|
| `create_contract` | Generate SSC from natural language | `{ description: string }` |
| `get_contract` | Retrieve contract by ID | `{ id: string }` |
| `validate_contract` | Check contract validity | `{ id: string }` |
| `list_contracts` | List user's contracts | `{ status?: string }` |

---

## Azure OpenAI Configuration

| Model | Deployment Name | Use Case |
|-------|-----------------|----------|
| GPT-5 Mini | `gpt-5-mini` | Contract generation (primary) |
| GPT-5 Nano | `gpt-5-nano` | Validation, quick checks |
| GPT-5.1 | `gpt-5.1` | Complex contracts |

**Endpoint**: `https://poly-ai-foundry.cognitiveservices.azure.com`
**API Version**: `2025-01-01-preview`

---

## PostgreSQL

| Field | Value |
|-------|-------|
| Host | `poly-alpa-postgresql.postgres.database.azure.com` |
| Database | `sesap` |
| User | `citus` |
| SSL | Required |

---

## Implementation Checklist

- [ ] Create MCP server (`server/mcp-server.ts`)
- [ ] Add Azure OpenAI client
- [ ] Add PostgreSQL schema and client
- [ ] Implement `create_contract` tool
- [ ] Implement `get_contract` tool
- [ ] Implement `validate_contract` tool  
- [ ] Implement `list_contracts` tool
- [ ] Connect frontend to MCP server
- [ ] Test with Claude Desktop

---

## Files to Create

```
sesap/
├── server/
│   ├── mcp-server.ts          # MCP server entry point
│   ├── tools/
│   │   ├── create-contract.ts  # Contract generation
│   │   └── contract-crud.ts    # Get/List/Validate
│   ├── llm/
│   │   └── azure-openai.ts     # Azure OpenAI client
│   ├── db/
│   │   ├── schema.sql          # PostgreSQL schema
│   │   └── client.ts           # PostgreSQL client
│   └── accord/
│       └── engine.ts           # Accord Project wrapper
├── package.json                # Add server dependencies
└── .env                        # Already configured ✓
```
