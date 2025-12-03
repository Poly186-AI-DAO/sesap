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

console.log("[DEBUG] main.tsx executing (no polyfills) - VERSION CHECK: FETCH_RESTORED");

// Suppress 404 console errors from TypeScript CDN lib fetching
// These are expected when playgroundcdn.typescriptlang.org has issues
// The template engine still works - it just skips type-checking
const originalError = console.error;
console.error = (...args) => {
  const msg = args[0]?.toString?.() || '';
  if (msg.includes('playgroundcdn.typescriptlang.org') || msg.includes('404')) {
    return; // Suppress CDN 404 noise
  }
  originalError.apply(console, args);
};

// NOTE: Do NOT intercept playgroundcdn.typescriptlang.org requests!
// The @accordproject/template-engine uses @typescript/vfs which needs to fetch
// TypeScript lib files (lib.d.ts, lib.es5.d.ts, etc.) from this CDN.
// Blocking these requests causes "Cannot find name 'Date'" errors in formula compilation.

// FORCE CLEAR LOCAL STORAGE to fix "Previous layout not found" error
try {
  localStorage.removeItem("react-resizable-panels:layout");
  console.log("[DEBUG] Cleared react-resizable-panels layout from localStorage");
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
