# SESAP MCP - Work In Progress

> **Last Updated**: 2024-12-11
> **Status**: 🟢 Phase 1.5 Complete → PostgreSQL Integration

---

## What Works NOW

```
Transcript.txt  →  GPT-5.1  →  GPT-5-mini  →  Contract Artifacts
                   (structure)   (Accord)       (model + template + data)
                                                      ↓
                                              Playground UI (renders)
```

**Test Result**: 50-min meeting transcript → 4 contract files generated
- GPT-5.1: 15,742 tokens (structure extraction)
- GPT-5-mini: 9,146 tokens (Accord artifact generation)

**Namespace**: `com.sesap.contract@1.0.0` (rebranded from org.accordproject)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT (Vanilla)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  server/                                                     │
│  ├── api.ts                 # Express API for frontend       │
│  ├── llm/                                                    │
│  │   └── azure-client.ts    # Azure OpenAI only              │
│  │                          # GPT-5.1 / 5-mini / 5-nano      │
│  │                          # Cascading model tiers          │
│  │                                                           │
│  ├── schemas/                                                │
│  │   └── contract.ts        # Zod schemas for structured out │
│  │                                                           │
│  └── scripts/                                                │
│      └── transcript-to-contract.ts                           │
│                             # 3-step pipeline                │
│                             # Zod structured output          │
│                             # NO frameworks (vanilla SDK)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**What We DON'T Use**:
- ❌ LangChain
- ❌ OpenAI Agents SDK
- ❌ Multi-provider (Anthropic, Google, etc)
- ❌ Browser-side LLM calls

**What We DO Use**:
- ✅ Azure AI Foundry (GPT-5.1, 5-mini, 5-nano)
- ✅ OpenAI SDK (vanilla)
- ✅ Zod structured output
- ✅ Cascading model tiers

---

## Robustness Improvements (Phase 1.5)

| Improvement | Status | Benefit |
|-------------|--------|---------|
| Zod structured output | ✅ DONE | Type-safe JSON, better parsing |
| Namespace rebrand | ✅ DONE | `com.sesap.contract@1.0.0` |
| Frontend integration | ✅ DONE | Generate Contract button in playground |
| API server | ✅ DONE | Express server on port 3001 |
| Retry logic | TODO | Handle rate limits, transient errors |
| Stream output | TODO | Better UX for long extractions |

---

## Pipeline Flow

```
┌──────────────┐     ┌─────────────────────────────────────────┐
│  Transcript  │────▶│  Step 1: GPT-5.1 (Heavy)                │
│  (.txt)      │     │  - Extract structure                     │
└──────────────┘     │  - Parties, phases, milestones           │
                     └────────────────┬────────────────────────┘
                                      ▼
                     ┌─────────────────────────────────────────┐
                     │  Step 2: GPT-5-mini (Medium)            │
                     │  - Generate Accord artifacts             │
                     │  - Concerto model, TemplateMark, JSON   │
                     └────────────────┬────────────────────────┘
                                      ▼
                     ┌─────────────────────────────────────────┐
                     │  Step 3: GPT-5-mini (Validation)        │
                     │  - Validate & polish                     │
                     │  - Fix template/data mismatches          │
                     └────────────────┬────────────────────────┘
                                      ▼
                     ┌─────────────────────────────────────────┐
                     │  Output: 4 Files                        │
                     │  - *_structure.json                      │
                     │  - *_model.cto                           │
                     │  - *_template.tem.md                     │
                     │  - *_data.json                           │
                     └─────────────────────────────────────────┘
```

---

## Files Created

| File | Purpose |
|------|---------|
| `server/api.ts` | Express API for frontend integration |
| `server/llm/azure-client.ts` | Azure OpenAI with tier-based models |
| `server/schemas/contract.ts` | Zod schemas for structured output |
| `server/scripts/transcript-to-contract.ts` | Main generation script |
| `server/tsconfig.json` | TypeScript config for server |
| `docs/contract_output/*` | Generated contract artifacts |

---

## Next Steps (Current Focus)

### 🔄 IN PROGRESS: PostgreSQL Integration

Integrate with our existing Postgres database to:
- Store generated contracts
- Track contract versions and history
- Link contracts to users/organizations
- Enable search and retrieval of past contracts

### Upcoming

1. **Phase 2**: Wrap in MCP server for agent integration
2. **Phase 3**: Add contract signing workflow
3. **Phase 4**: Multi-party contract negotiation
