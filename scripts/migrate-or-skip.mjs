#!/usr/bin/env node
/**
 * Prebuild hook — runs Drizzle migrations against the DB pointed at by
 * DATABASE_URL, BUT only when that URL looks like a real remote target
 * (libsql:// or https://). Falls through cleanly for local builds and
 * for Vercel preview deploys that don't have a DB url set.
 *
 * Why a wrapper instead of `prebuild: npm run db:migrate`:
 *   - Local `npm run build` (e.g. during development testing) shouldn't
 *     scribble on `./data/local.db` just because a build was triggered.
 *   - Preview deploys without their own DB should not crash the build.
 *   - We want the build log to clearly state "migrations applied" or
 *     "migrations skipped (no remote DB)" — easier to debug.
 *
 * Production deploys always have DATABASE_URL=libsql://...turso.io, so
 * this is a no-op skip locally and a real migration on production
 * Vercel builds.
 */

import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const isRemote = url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("wss://");

if (!isRemote) {
  console.log(`[prebuild] DATABASE_URL not remote (=${url || "unset"}) — skipping migration`);
  process.exit(0);
}

console.log(`[prebuild] running migrations against ${url}`);
const result = spawnSync("npm", ["run", "db:migrate"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  console.error("[prebuild] migration failed — aborting build");
  process.exit(result.status ?? 1);
}

console.log("[prebuild] migration complete");
