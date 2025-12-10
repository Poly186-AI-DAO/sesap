# LLM Structured Output - Lessons Learned

This document tracks what we've learned about OpenAI/Azure structured output to avoid repeating mistakes.

## Date: 2025-12-10

### Key Rules for OpenAI Structured Output

| Rule | Description | Fix |
|------|-------------|-----|
| **All fields required** | OpenAI structured output doesn't support `.optional()` | Use `.nullable()` instead - fields can be `null` but must be present |
| **No z.record()** | `z.record()` generates `propertyNames` in JSON schema, which isn't supported | Use `z.string()` for arbitrary JSON - output as string, parse after |
| **Zod 4 + SDK 6** | OpenAI SDK 5.x uses `zod-to-json-schema` which doesn't support Zod 4.x | Upgrade to OpenAI SDK 6.x for Zod 4 compatibility |
| **No z.any()** | Avoid `z.any()` - use `z.unknown()` for stricter typing | Replace with `z.unknown()` or specific types |

---

### Detailed Learnings

#### 1. Reasoning Models Need Large max_tokens

**Problem:**
```
finish_reason: length
reasoning_tokens: 8192  ← Used ALL tokens for "thinking"!
completion_tokens: 8192
content: null  ← Nothing left for actual output
```

**Fix:**
```typescript
// ❌ Too small for reasoning models
{ maxTokens: 8192 }

// ✅ Give room for reasoning + output
{ maxTokens: 16384 }  // For structure extraction
{ maxTokens: 32768 }  // For large artifact generation
```

**Rule of thumb:** Reasoning models (GPT-5.x) use ~50-80% of tokens for internal reasoning. If you need 4K output, request 16K+ tokens.

---

#### 2. .optional() → .nullable()

**Problem:**
```typescript
// ❌ This breaks structured output
notes: z.string().optional()
```

**Error:**
```
Zod field uses `.optional()` without `.nullable()` which is not supported by the API
```

**Fix:**
```typescript
// ✅ This works
notes: z.string().nullable().describe('Additional notes, or null if none')
```

**For arrays, use empty arrays instead of null:**
```typescript
// ✅ Arrays should never be nullable - use empty array
contacts: z.array(ContactSchema).describe('Key contacts, empty array if none')
```

---

#### 2. z.record() → z.string() + parse

**Problem:**
```typescript
// ❌ This breaks structured output  
jsonData: z.record(z.string(), z.unknown())
```

**Error:**
```
'propertyNames' is not permitted
```

**Fix:**
```typescript
// ✅ Output as JSON string, parse after receiving
jsonData: z.string().describe('JSON data as a JSON string')

// Then parse:
const data = JSON.parse(response.jsonData);
```

---

#### 3. Zod 4 + OpenAI SDK Compatibility

**Problem:** Zod 4.x is not compatible with OpenAI SDK 5.x because it uses `zod-to-json-schema` which expects Zod 3.x.

**Error:**
```typescript
// zodResponseFormat produces wrong schema:
{ "type": "string" }  // Should be an object!
```

**Fix:**
```bash
# Upgrade to OpenAI SDK 6.x which supports Zod 4
npm install openai@^6.10.0
```

---

### Testing Structured Output Schemas

Before using a schema, test it:

```typescript
import { zodResponseFormat } from 'openai/helpers/zod';
import { MySchema } from './schemas';

const format = zodResponseFormat(MySchema, 'MySchema');
console.log(JSON.stringify(format, null, 2));

// Verify:
// 1. type is "object" (not "string")
// 2. No "propertyNames" in any properties
// 3. All fields are in "required" array
```

---

### Package Versions That Work

```json
{
  "openai": "^6.10.0",
  "zod": "^4.1.13"
}
```

---

### Links

- [OpenAI Structured Output Guide](https://platform.openai.com/docs/guides/structured-outputs)
- [All fields must be required](https://platform.openai.com/docs/guides/structured-outputs#all-fields-must-be-required)
- [OpenAI Node SDK Helpers](https://github.com/openai/openai-node/blob/master/helpers.md)
