import { defineConfig as defineViteConfig, mergeConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { visualizer } from "rollup-plugin-visualizer";
// https://vitejs.dev/config/
const viteConfig = defineViteConfig({
  plugins: [
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    react(),
    visualizer({
      emitFile: true,
      filename: "stats.html",
    }),
  ],

  optimizeDeps: {
    include: ["immer", "util", "inherits"],
    needsInterop: ["@accordproject/template-engine"],
  },
  resolve: {
    alias: {
      util: 'vite-plugin-node-polyfills/polyfills/util',
      inherits: 'inherits',
      '@accordproject/markdown-transform': '@accordproject/markdown-transform/index.js',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

// https://vitest.dev/config/
const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/utils/testing/setup.ts",
  },
});

export default mergeConfig(viteConfig, vitestConfig);
