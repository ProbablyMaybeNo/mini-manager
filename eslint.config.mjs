import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/node_modules/**",
    // Stale batch-agent git worktrees (each carries its own .next build output
    // of compiled node_modules / turbopack chunks — not source). The whole
    // .claude/ dir is local tooling state, never linted.
    ".claude/**",
    // Generated service worker bundle (stamped at build time, not source).
    "public/sw.js",
    "public/sw.js.map",
    "public/swe-worker-*.js",
  ]),
]);

export default eslintConfig;
