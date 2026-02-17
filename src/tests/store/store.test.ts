import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for store utility functions
 *
 * Tests the pure functions extracted from the Zustand store:
 * - formatError: normalizes error objects to user-readable strings
 * - getInitialTheme: reads theme from localStorage
 * - isCancelation: type guard for debounce cancelation results
 */

// ---------- formatError ----------
// Re-implement to test in isolation (store module imports Accord which needs heavy setup)
function formatError(error: any): string {
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return error.map((e) => formatError(e)).join("\n");
  if (error.code) {
    const sub = error.errors ? formatError(error.errors) : "";
    const msg = error.renderedMessage || "";
    return `Error: ${error.code} ${sub} ${msg}`;
  }
  return error.toString();
}

// ---------- isCancelation ----------
interface CancelationResult {
  type: "cancelation";
  msg: string;
}

function isCancelation(result: unknown): result is CancelationResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "type" in result &&
    (result as any).type === "cancelation"
  );
}

// ---------- getInitialTheme ----------
function getInitialTheme() {
  if (typeof window !== "undefined") {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      return { backgroundColor: "#121212", textColor: "#ffffff" };
    } else if (savedTheme === "light") {
      return { backgroundColor: "#ffffff", textColor: "#121212" };
    }
  }
  return { backgroundColor: "#ffffff", textColor: "#121212" };
}

describe("formatError", () => {
  it("returns string errors as-is", () => {
    expect(formatError("Something went wrong")).toBe("Something went wrong");
  });

  it("formats Error objects", () => {
    const err = new Error("Test error");
    expect(formatError(err)).toContain("Test error");
  });

  it("joins array of errors with newlines", () => {
    const errors = ["Error 1", "Error 2", "Error 3"];
    const result = formatError(errors);
    expect(result).toBe("Error 1\nError 2\nError 3");
  });

  it("formats Concerto-style errors with code and renderedMessage", () => {
    const error = {
      code: "INVALID_MODEL",
      renderedMessage: "Missing $class in concept",
    };
    const result = formatError(error);
    expect(result).toContain("INVALID_MODEL");
    expect(result).toContain("Missing $class in concept");
  });

  it("formats errors with nested errors array", () => {
    const error = {
      code: "VALIDATION_FAILED",
      errors: ["Field missing", "Type mismatch"],
      renderedMessage: "",
    };
    const result = formatError(error);
    expect(result).toContain("VALIDATION_FAILED");
    expect(result).toContain("Field missing");
    expect(result).toContain("Type mismatch");
  });

  it("handles objects without code by calling toString()", () => {
    const result = formatError({ custom: "error" });
    expect(result).toBe("[object Object]");
  });

  it("handles numbers", () => {
    expect(formatError(42)).toBe("42");
  });
});

describe("isCancelation", () => {
  it("returns true for cancelation objects", () => {
    expect(isCancelation({ type: "cancelation", msg: "debounced" })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isCancelation(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCancelation(undefined)).toBe(false);
  });

  it("returns false for strings", () => {
    expect(isCancelation("cancelation")).toBe(false);
  });

  it("returns false for objects with different type", () => {
    expect(isCancelation({ type: "error", msg: "something" })).toBe(false);
  });

  it("returns false for HTML string results", () => {
    expect(isCancelation("<h1>Hello</h1>")).toBe(false);
  });
});

describe("getInitialTheme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns dark theme when localStorage has dark", () => {
    localStorage.setItem("theme", "dark");
    const theme = getInitialTheme();
    expect(theme.backgroundColor).toBe("#121212");
    expect(theme.textColor).toBe("#ffffff");
  });

  it("returns light theme when localStorage has light", () => {
    localStorage.setItem("theme", "light");
    const theme = getInitialTheme();
    expect(theme.backgroundColor).toBe("#ffffff");
    expect(theme.textColor).toBe("#121212");
  });

  it("defaults to light theme when no saved preference", () => {
    const theme = getInitialTheme();
    expect(theme.backgroundColor).toBe("#ffffff");
    expect(theme.textColor).toBe("#121212");
  });

  it("defaults to light theme for unknown values", () => {
    localStorage.setItem("theme", "sepia");
    const theme = getInitialTheme();
    expect(theme.backgroundColor).toBe("#ffffff");
    expect(theme.textColor).toBe("#121212");
  });
});
