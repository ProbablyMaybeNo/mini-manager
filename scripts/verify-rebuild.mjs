#!/usr/bin/env node
/**
 * FIGMA-REBUILD verification gate — runs the full mission pyramid in order.
 * Use after each rebuild slice and before calling the redesign "done".
 *
 *   npm run test:verify
 *
 * Layers (stop on first failure):
 *   1. typecheck
 *   2. unit (Vitest)
 *   3. integration (Vitest + in-memory libsql)
 *   4. e2e missions (Playwright qa_*.spec.ts)
 *
 * See docs/MISSIONS.md § "FIGMA Rebuild" and docs/TESTING.md.
 */

import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";

const steps = [
  { name: "typecheck", cmd: "npm", args: ["run", "typecheck"] },
  { name: "unit", cmd: "npm", args: ["run", "test:unit"] },
  { name: "integration", cmd: "npm", args: ["run", "test:integration"] },
  { name: "e2e-missions", cmd: "npm", args: ["run", "test:e2e"] },
];

console.log("FIGMA-REBUILD verify — running mission pyramid…\n");

for (const step of steps) {
  console.log(`▶ ${step.name}`);
  const result = spawnSync(step.cmd, step.args, {
    stdio: "inherit",
    shell: isWin,
    env: {
      ...process.env,
      ALLOW_TEST_AUTH: "1",
    },
  });
  if (result.status !== 0) {
    console.error(`\n✗ verify failed at: ${step.name}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${step.name}\n`);
}

console.log("✓ FIGMA-REBUILD verify — all layers green");
