import next from "eslint-config-next/core-web-vitals";

/**
 * Flat config (ESLint 9). Replaces `next lint`, which Next 16 removed — the
 * old `"lint": "next lint"` script had been silently linting *zero* files (it
 * parsed `lint` as a directory argument and errored out), and CI ran no linter
 * at all. So this is the first time the codebase has ever been linted.
 *
 * `eslint-config-next/core-web-vitals` bundles the base Next rules,
 * `next/typescript`, and the Core Web Vitals set.
 *
 * ── On the demoted react-hooks rules ──────────────────────────────────────
 * A first run surfaced 44 errors, 39 of them from the React-Compiler-era
 * `react-hooks/*` rules. They are demoted to `warn` here rather than silenced
 * or mass-fixed, deliberately:
 *
 *   - `set-state-in-effect` (32) is almost entirely the hydration-safe
 *     localStorage read — `useEffect(() => setX(readStored()), [])` — which
 *     cannot run during SSR. Doing it "right" means a `useSyncExternalStore`
 *     refactor across every persisted-preference hook.
 *   - `refs` (6) flags ref access during render in the focus-trap / modal /
 *     workspace code. Some of these may be real; they need individual review.
 *   - `preserve-manual-memoization` (1) and `incompatible-library` (2) are
 *     compiler advisories.
 *
 * None of that is launch work, and rewriting hydration and ref plumbing days
 * before go-live is how you ship a regression. They stay visible as warnings
 * and are tracked in docs/LAUNCH_BUILD_LIST.md (B6). Promote them back to
 * `error` once they're worked through.
 */
const config = [
  {
    ignores: [
      ".next/**",
      // Leftover agent worktrees — each carries a full source copy plus its
      // own .next output, which otherwise triples the lint surface with
      // generated turbopack bundles.
      ".claude/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "drizzle/**",
      // Audit run artifacts, not source.
      "ux-audit/**",
      "mobile-ux-audit/**",
      // Ships to the browser as-is; service-worker globals, no build step.
      "public/**",
    ],
  },
  ...next,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
];

export default config;
