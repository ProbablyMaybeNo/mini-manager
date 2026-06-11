import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vitest config — three projects:
 *
 *   "unit"        — pure-function tests. Fast. Node env. No DB, no fetch.
 *                   Covers scrape parsers, cascade rules, quickAdd parser,
 *                   kit inference, search ranker, paint filters, OG meta.
 *
 *   "integration" — server-action + DB tests. Each test gets a fresh
 *                   in-memory libsql instance with migrations applied
 *                   via tests/integration/_setup.ts. Slower (~5s).
 *
 *   "ui"          — component + UI-unit tests for the transplanted Figma
 *                   presentation layer. jsdom env, React plugin, Testing
 *                   Library matchers via src/test/setup.ts. Covers
 *                   src/**\/*.test.{ts,tsx} (kit, views, color, derive).
 *
 * Run with:
 *   npm test                  all projects
 *   npm run test:unit         unit only
 *   npm run test:integration  integration only
 *   npm run test:watch        unit project in watch mode
 *   npm run test:ui           Vitest browser UI
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Replace the real `server-only` guard package with an empty module
      // so vitest can import server modules (scrape parsers, queries) in
      // Node env. The real package only exists to trip client bundlers.
      "server-only": path.resolve(__dirname, "./tests/unit/_shims/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          globals: false,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globals: false,
          testTimeout: 15_000,
          hookTimeout: 15_000,
          setupFiles: ["./tests/integration/_setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "ui",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          css: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/db/queries/**"],
      exclude: [
        "src/**/*.test.ts",
        "src/lib/silhouettes/**",
        "tests/**",
      ],
    },
  },
});
