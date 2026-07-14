#!/usr/bin/env node
/**
 * Prebuild hook (UX-1505) — stamp a per-deploy BUILD_ID into the service
 * worker so its cache names change on every deploy.
 *
 * MUST run BEFORE `next build`, not after: `next build` copies /public into
 * the build output during the build, so a postbuild stamp modifies the
 * source sw.js too late — Vercel serves the already-snapshotted, unstamped
 * copy (Round 18 found the deployed /sw.js still carried `__BUILD_ID__`).
 * Chained into `prebuild` after the migrate step so the stamped file is on
 * disk when Next snapshots /public.
 *
 * `public/sw.js` ships with a `__BUILD_ID__` placeholder token. Each deploy
 * we replace it with a stable-per-build identifier:
 *   - Vercel sets VERCEL_GIT_COMMIT_SHA → use the short SHA (deterministic,
 *     human-traceable to the deploy).
 *   - Otherwise fall back to an ISO-ish timestamp so local/standalone builds
 *     still get a fresh cache namespace.
 *
 * After Next's build copies /public verbatim into the deploy, the served
 * /sw.js carries a unique cache name. On the next visit the new worker
 * activates, skipWaiting()s, claims clients, and deletes every cache from a
 * prior BUILD_ID — so returning users get the fresh build without a manual
 * cache clear (the bug that stranded the Round-13 batch behind mm-shell-v1).
 *
 * Idempotent + safe: if the token is already gone (re-run) we no-op rather
 * than fail the build.
 *
 * Scoped to the BUILD_ID assignment line ONLY. An earlier version replaced
 * every occurrence of the token in the file, which rewrote the prose in the
 * comments above (including the line insisting the token stay spelled
 * `__BUILD_ID__`) and left the source permanently mangled.
 *
 * `postbuild` restores the placeholder (see restore-sw-placeholder.mjs), so
 * a local `npm run build` no longer dirties the working tree — which is what
 * failed tests/unit/lib/sw/strategy.test.ts. Restoring is safe on Vercel:
 * `next build` snapshots /public *during* the build (the Round-18 finding
 * that forced this script from postbuild to prebuild in the first place), so
 * a postbuild write to the source cannot reach the deploy.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const swPath = join(here, "..", "public", "sw.js");

const TOKEN = "__BUILD_ID__";
/** The one line that carries the token. Kept in lock-step with sw.js. */
const ASSIGNMENT = /^const BUILD_ID = .*;$/m;

function buildId() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha && sha.length > 0) return sha.slice(0, 12);
  // Compact timestamp: 2026-06-02T1530 → 20260602-1530xx
  return new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\..+$/, "");
}

let src;
try {
  src = readFileSync(swPath, "utf-8");
} catch (err) {
  console.error(`[prebuild] could not read ${swPath}: ${err.message}`);
  process.exit(1);
}

const assignment = src.match(ASSIGNMENT);

if (!assignment) {
  console.error(
    `[prebuild] sw.js has no 'const BUILD_ID = …;' line — cannot stamp. ` +
      `Did the assignment get renamed?`,
  );
  process.exit(1);
}

// Test the ASSIGNMENT LINE, not the whole file: the token also appears in the
// doc comments above (deliberately — they explain it), so a whole-file check
// would never register as already-stamped.
if (!assignment[0].includes(TOKEN)) {
  console.log(`[prebuild] sw.js BUILD_ID already stamped — skipping`);
  process.exit(0);
}

const id = buildId();
const stamped = src.replace(ASSIGNMENT, `const BUILD_ID = ${JSON.stringify(id)};`);
writeFileSync(swPath, stamped, "utf-8");
console.log(`[prebuild] stamped sw.js BUILD_ID = ${id}`);
