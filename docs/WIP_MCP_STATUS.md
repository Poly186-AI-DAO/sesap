# SESAP MCP - Work In Progress

> **Last Updated**: 2024-12-10
> **Status**: 🟢 Phase 1 Complete → Robustifying

---

## What Works NOW

```
Transcript.txt  →  GPT-5.1  →  GPT-5-mini  →  Contract Artifacts
                   (structure)   (Accord)       (model + template + data)
```

**Test Result**: 50-min meeting transcript → 4 contract files generated
- GPT-5.1: 15,742 tokens (structure extraction)
- GPT-5-mini: 9,146 tokens (Accord artifact generation)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT (Vanilla)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  server/                                                     │
│  ├── llm/                                                    │
│  │   └── azure-client.ts    # Azure OpenAI only              │
│  │                          # GPT-5.1 / 5-mini / 5-nano      │
│  │                          # Cascading model tiers          │
│  │                                                           │
│  └── scripts/                                                │
│      └── transcript-to-contract.ts                           │
│                             # 3-step pipeline                │
│                             # JSON response format           │
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
- ✅ JSON response format
- ✅ Cascading model tiers

---

## Robustness Improvements (Phase 1.5)

| Improvement | Status | Benefit |
|-------------|--------|---------|
| Zod structured output | TODO | Type-safe JSON, better parsing |
| Retry logic | TODO | Handle rate limits, transient errors |
| Stream output | TODO | Better UX for long extractions |
| Clean up old LLM providers | TODO | Remove unused code in `src/ai-assistant/` |

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
                     │  Step 3: GPT-5-nano (Light) [optional]  │
                     │  - Validate & polish                     │
                     │  - Falls back to Step 2 if fails         │
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
| `server/llm/azure-client.ts` | Azure OpenAI with tier-based models |
| `server/scripts/transcript-to-contract.ts` | Main generation script |
| `server/tsconfig.json` | TypeScript config for server |
| `docs/contract_output/*` | Generated contract artifacts |

---

## Next Steps

1. **Phase 1.5**: Add Zod structured output for robust parsing
2. **Phase 2**: Wrap in MCP server
3. **Phase 3**: Connect to PostgreSQL
4. **Phase 4**: Integrate with frontend playground
