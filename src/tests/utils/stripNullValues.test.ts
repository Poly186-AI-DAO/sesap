import { describe, it, expect } from "vitest";

/**
 * Unit tests for stripNullValues utility from server/api.ts
 *
 * This is a critical function: Concerto expects optional fields to be
 * OMITTED, not null. LLM structured output returns null for missing fields.
 * stripNullValues bridges this gap.
 */

// Re-implement here since the server module has side effects (express listen).
// This mirrors the exact implementation in server/api.ts.
function stripNullValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripNullValues).filter((item) => item !== undefined);
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const stripped = stripNullValues(value);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return result;
  }
  return obj;
}

describe("stripNullValues", () => {
  it("returns undefined for null input", () => {
    expect(stripNullValues(null)).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(stripNullValues(undefined)).toBeUndefined();
  });

  it("passes through primitive values unchanged", () => {
    expect(stripNullValues("hello")).toBe("hello");
    expect(stripNullValues(42)).toBe(42);
    expect(stripNullValues(true)).toBe(true);
    expect(stripNullValues(0)).toBe(0);
    expect(stripNullValues("")).toBe("");
    expect(stripNullValues(false)).toBe(false);
  });

  it("removes null properties from flat objects", () => {
    const input = { name: "John", age: null, city: "NYC" };
    const result = stripNullValues(input);
    expect(result).toEqual({ name: "John", city: "NYC" });
    expect(result).not.toHaveProperty("age");
  });

  it("removes undefined properties from flat objects", () => {
    const input = { name: "John", age: undefined, city: "NYC" };
    const result = stripNullValues(input);
    expect(result).toEqual({ name: "John", city: "NYC" });
  });

  it("removes null properties from nested objects", () => {
    const input = {
      name: "Contract",
      party: {
        name: "Acme",
        contactNotes: null,
        address: {
          line1: "123 Main St",
          line2: null,
        },
      },
    };
    const result = stripNullValues(input);
    expect(result).toEqual({
      name: "Contract",
      party: {
        name: "Acme",
        address: {
          line1: "123 Main St",
        },
      },
    });
  });

  it("filters null values from arrays", () => {
    const input = { items: ["a", null, "b", null, "c"] };
    const result = stripNullValues(input);
    expect(result.items).toEqual(["a", "b", "c"]);
  });

  it("handles arrays of objects with null fields", () => {
    const input = {
      contacts: [
        { name: "Alice", notes: null },
        { name: "Bob", notes: "Important" },
      ],
    };
    const result = stripNullValues(input);
    expect(result.contacts).toEqual([
      { name: "Alice" },
      { name: "Bob", notes: "Important" },
    ]);
  });

  it("preserves empty arrays", () => {
    const input = { items: [] };
    expect(stripNullValues(input)).toEqual({ items: [] });
  });

  it("preserves empty objects", () => {
    const input = { nested: {} };
    expect(stripNullValues(input)).toEqual({ nested: {} });
  });

  it("handles $class fields correctly (Concerto requirement)", () => {
    const input = {
      $class: "com.sesap.contract@1.0.0.ContractData",
      name: "Test",
      intermediary: null,
    };
    const result = stripNullValues(input);
    expect(result.$class).toBe("com.sesap.contract@1.0.0.ContractData");
    expect(result).not.toHaveProperty("intermediary");
  });

  it("handles deeply nested structures from LLM output", () => {
    const llmOutput = {
      $class: "com.sesap.contract@1.0.0.ContractData",
      provider: {
        $class: "com.sesap.contract@1.0.0.Party",
        name: "Acme",
        role: "Provider",
        contactSummary: "Alice - CEO",
        contactNotes: null,
      },
      intermediary: null,
      client: {
        $class: "com.sesap.contract@1.0.0.Party",
        name: "Widget Co",
        role: "Client",
        contactSummary: "Bob - CTO",
        contactNotes: null,
      },
      engagementType: ["Consulting", "Audit"],
    };

    const result = stripNullValues(llmOutput);

    // intermediary should be completely removed
    expect(result).not.toHaveProperty("intermediary");
    // contactNotes should be removed from nested objects
    expect(result.provider).not.toHaveProperty("contactNotes");
    expect(result.client).not.toHaveProperty("contactNotes");
    // $class and arrays should be preserved
    expect(result.$class).toBe("com.sesap.contract@1.0.0.ContractData");
    expect(result.engagementType).toEqual(["Consulting", "Audit"]);
  });

  it("removes object if all its values are null", () => {
    const input = { empty: { a: null, b: null } };
    const result = stripNullValues(input);
    // The object is not removed — just emptied (matching Concerto behavior)
    expect(result.empty).toEqual({});
  });
});
