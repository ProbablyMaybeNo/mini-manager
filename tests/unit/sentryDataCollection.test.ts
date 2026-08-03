import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * R2-21 — Sentry must not ship HTTP request bodies to a third party. The app
 * POSTs plaintext credentials to sign-in/sign-up, and errors on that path are
 * realistic, so bodies are turned off at the source rather than relying on
 * Sentry's dashboard-side scrubbers (which live outside this repo).
 *
 * These are config assertions, not a live capture: exercising a real event
 * end-to-end would spend the free-tier error quota.
 *
 * The trap this file exists to guard: `dataCollection` is resolved by
 * branching on whether the KEY IS PRESENT, not on what it contains —
 * @sentry/core resolveDataCollectionOptions:
 *
 *   const base = options.dataCollection != null
 *     ? DEFAULTS                                  // permissive
 *     : defaultPiiToCollectionOptions(options.sendDefaultPii);
 *
 * So the scaffold's `dataCollection: {}` with everything commented out is
 * strictly WORSE than having no block at all: `{} != null`, so every unset
 * field resolves to the permissive DEFAULTS (userInfo on, httpBodies = all
 * four targets, genAI inputs+outputs on). Re-emptying this block silently
 * re-opens all of it, which is why "block is non-empty" is asserted below.
 */

/** Every runtime that calls Sentry.init. There is no sentry.client.config.ts
 *  in this project — the browser init lives in src/instrumentation-client.ts. */
const CONFIGS = [
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
  path.join("src", "instrumentation-client.ts"),
] as const;

/** Pull out the `dataCollection: { ... }` literal by brace-matching, then
 *  strip line comments so assertions can't be satisfied by a commented-out
 *  line (the exact failure mode R2-21 reported). */
function dataCollectionBlock(file: string): string {
  const src = readFileSync(path.join(process.cwd(), file), "utf8");
  const start = src.indexOf("dataCollection:");
  expect(start, `${file}: no dataCollection block`).toBeGreaterThan(-1);

  const open = src.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  expect(end, `${file}: unbalanced dataCollection block`).toBeGreaterThan(-1);

  return src
    .slice(open, end)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("R2-21 Sentry dataCollection", () => {
  test.each(CONFIGS)("%s disables HTTP body collection", (file) => {
    expect(dataCollectionBlock(file)).toMatch(/httpBodies:\s*\[\s*\]/);
  });

  test.each(CONFIGS)("%s does not auto-populate user.*", (file) => {
    // Not redundant with the SDK's `@default false` JSDoc: that default only
    // applies on the no-block branch. With the block present it resolves true.
    expect(dataCollectionBlock(file)).toMatch(/userInfo:\s*false/);
  });

  test.each(CONFIGS)("%s keeps genAI prompts out of Sentry", (file) => {
    expect(dataCollectionBlock(file)).toMatch(/inputs:\s*false/);
  });

  test.each(CONFIGS)("%s dataCollection block is not empty", (file) => {
    // An empty block selects the permissive DEFAULTS — see the header comment.
    expect(dataCollectionBlock(file)).not.toBe("{ }");
    expect(dataCollectionBlock(file)).not.toBe("{}");
  });

  test("all runtimes are configured identically", () => {
    const [server, ...rest] = CONFIGS.map(dataCollectionBlock);
    for (const other of rest) expect(other).toBe(server);
  });

  test("local-variable capture stays off (includeLocalVariables unset)", () => {
    // The auth actions hold a plaintext `input.password` local across an await
    // that can throw. Capture is gated on `includeLocalVariables`, NOT on
    // dataCollection.stackFrameVariables, so guard the option that matters.
    for (const file of CONFIGS) {
      const src = readFileSync(path.join(process.cwd(), file), "utf8").replace(
        /\/\/[^\n]*/g,
        "",
      );
      expect(src, `${file}: local variable capture must stay off`).not.toMatch(
        /includeLocalVariables:\s*true/,
      );
    }
  });
});
