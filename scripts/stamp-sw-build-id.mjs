#!/usr/bin/env node
/**
 * Postbuild hook (UX-1505) — stamp a per-deploy BUILD_ID into the service
 * worker so its cache names change on every deploy.
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
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const swPath = join(here, "..", "public", "sw.js");

const TOKEN = "__BUILD_ID__";

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
  console.error(`[postbuild] could not read ${swPath}: ${err.message}`);
  process.exit(1);
}

if (!src.includes(TOKEN)) {
  console.log(`[postbuild] sw.js has no ${TOKEN} token — already stamped, skipping`);
  process.exit(0);
}

const id = buildId();
const stamped = src.split(TOKEN).join(id);
writeFileSync(swPath, stamped, "utf-8");
console.log(`[postbuild] stamped sw.js BUILD_ID = ${id}`);
