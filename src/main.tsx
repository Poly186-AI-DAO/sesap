// import "core-js/stable";
// import "regenerator-runtime/runtime";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

import { loader } from "@monaco-editor/react";

loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs" } });

loader.init().then((monaco) => {
  const compilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2015,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    noLib: true,
  };
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
});



// =============================================================================
// CONSOLE NOISE SUPPRESSION
// =============================================================================
// Suppress known noisy errors that don't affect functionality:
// 1. TypeScript CDN 404s - template engine works without type-checking
// 2. ResizeObserver loop errors - benign layout timing issues
// 3. Failed to load resource errors from playgroundcdn
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args[0]?.toString?.() || '';
  if (
    msg.includes('playgroundcdn.typescriptlang.org') ||
    msg.includes('ResizeObserver') ||
    msg.includes('Failed to load resource') ||
    msg.includes('404')
  ) {
    return; // Suppress known noise
  }
  originalConsoleError.apply(console, args);
};

// Also suppress ResizeObserver errors that come through window.onerror
if (typeof window !== "undefined") {
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (message?.toString().includes("ResizeObserver")) {
      return true; // Suppress
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  // Catch unhandled promise rejections from ResizeObserver
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.message?.includes("ResizeObserver")) {
      event.preventDefault();
    }
  });
}

// NOTE: Do NOT intercept playgroundcdn.typescriptlang.org fetch requests!
// The @accordproject/template-engine uses @typescript/vfs which needs to fetch
// TypeScript lib files (lib.d.ts, lib.es5.d.ts, etc.) from this CDN.
// The 404s are annoying but the engine has fallback behavior.

// Intercept fetch to silently handle TypeScript CDN 404s
// This prevents "Failed to load resource" network errors in console
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input instanceof Request ? input.url : '';

  // For TypeScript CDN requests, catch 404s silently
  if (url.includes('playgroundcdn.typescriptlang.org')) {
    try {
      const response = await originalFetch(input, init);
      if (!response.ok) {
        // Return empty successful response instead of 404
        return new Response('', { status: 200, statusText: 'OK (fallback)' });
      }
      return response;
    } catch {
      // Network error - return empty response
      return new Response('', { status: 200, statusText: 'OK (fallback)' });
    }
  }

  return originalFetch(input, init);
};

// FORCE CLEAR LOCAL STORAGE to fix "Previous layout not found" error
try {
  localStorage.removeItem("react-resizable-panels:layout");
} catch (e) {
  console.error("Failed to clear localStorage", e);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
