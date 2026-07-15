#!/usr/bin/env node
/**
 * Postbuild hook — put the `__BUILD_ID__` placeholder back into the
 * service-worker source after `prebuild` stamped a concrete id into it.
 *
 * Why this exists: `stamp-sw-build-id.mjs` has to run BEFORE `next build`
 * (Next snapshots /public *during* the build, so a postbuild stamp never
 * reaches the deploy — the Round-18 finding). But it stamps the file in
 * place, which means every local `npm run build` left `public/sw.js` dirty
 * with a concrete id — permanently, since the stamp script no-ops once the
 * token is gone. That dirty source is what failed
 * `tests/unit/lib/sw/strategy.test.ts`, which asserts the source still
 * carries the placeholder.
 *
 * This is a LOCAL-ONLY restore: it no-ops on Vercel and in CI.
 *
 * Why: whether `/public` is snapshotted *during* `next build` or collected
 * *after* the npm build script finishes (i.e. after this hook) decides whether
 * restoring here would ship an UNSTAMPED sw.js and silently kill the whole
 * cache-busting mechanism. The stamp script's header asserts the former, but
 * `next build` writes no sw.js into `.next` at all, so that ordering can't be
 * confirmed locally — and it is not worth betting the deploy on. Skipping the
 * restore on Vercel/CI is correct under BOTH orderings: the build container's
 * source stays stamped (and is thrown away), while a developer's working tree
 * still comes back clean.
 *
 * Consequence worth knowing: a local `npm run build && npm start` serves the
 * restored source, so BUILD_ID falls back to "dev". That is the intended dev
 * behaviour (cache names stay namespaced, just stable) and never affects a
 * deploy.
 *
 * Idempotent: if the placeholder is already there, no-op.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Never touch a real build's source. See the header — the /public snapshot
// ordering on Vercel is unconfirmed, so we simply never restore where it could
// reach a deploy.
if (process.env.VERCEL || process.env.CI) {
  console.log("[postbuild] Vercel/CI build — leaving sw.js stamped");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const swPath = join(here, "..", "public", "sw.js");

const TOKEN = "__BUILD_ID__";
/** Kept in lock-step with sw.js and stamp-sw-build-id.mjs. */
const ASSIGNMENT = /^const BUILD_ID = .*;$/m;
const PRISTINE = `const BUILD_ID = "${TOKEN}".startsWith("__") ? "dev" : "${TOKEN}";`;

let src;
try {
  src = readFileSync(swPath, "utf-8");
} catch (err) {
  console.error(`[postbuild] could not read ${swPath}: ${err.message}`);
  process.exit(1);
}

const assignment = src.match(ASSIGNMENT);

if (!assignment) {
  console.error(
    `[postbuild] sw.js has no 'const BUILD_ID = …;' line to restore. ` +
      `Source may be mangled — check it against git.`,
  );
  process.exit(1);
}

// Test the ASSIGNMENT LINE, not the whole file: the doc comments above it
// legitimately still contain the token (the stamp is scoped to this one line),
// so a whole-file `includes(TOKEN)` check would always think it was restored.
if (assignment[0].includes(TOKEN)) {
  console.log(`[postbuild] sw.js BUILD_ID already unstamped — nothing to restore`);
  process.exit(0);
}

writeFileSync(swPath, src.replace(ASSIGNMENT, PRISTINE), "utf-8");
console.log(`[postbuild] restored sw.js ${TOKEN} placeholder`);
