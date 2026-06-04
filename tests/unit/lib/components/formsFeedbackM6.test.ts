/**
 * M6 — Forms & feedback.
 *
 * Source-scan net for the M6 deliverables [MOBILE §M6]:
 *
 *   step 1 — input optimization on the email form (type/inputmode/
 *            autocomplete/label-above/inline field error).
 *   step 4 — StageCounter polish: − / + at opposite ends, long-press
 *            repeat, tap-number-to-type (with a setCounter action that
 *            cascade-validates the absolute value).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("M6 step 1 — email input optimization", () => {
  const src = read("src/components/user/RecoveryEmailCard.tsx");

  test("email field uses the email keyboard + autocomplete", () => {
    expect(src).toMatch(/type="email"/);
    expect(src).toMatch(/inputMode="email"/);
    expect(src).toMatch(/autoComplete="email"/);
  });

  test("field has a visible label-above bound by htmlFor/id", () => {
    expect(src).toMatch(/htmlFor="recovery-email"/);
    expect(src).toMatch(/id="recovery-email"/);
  });

  test("inline field-level error wired via aria-invalid + aria-describedby", () => {
    expect(src).toMatch(/aria-invalid=\{error \? true : undefined\}/);
    expect(src).toMatch(/aria-describedby=\{error \? "recovery-email-error" : undefined\}/);
    expect(src).toMatch(/id="recovery-email-error"/);
  });

  test("typing clears the previous error (recover-as-you-go)", () => {
    expect(src).toMatch(/if \(error\) setError\(null\)/);
  });
});

describe("M6 step 4 — StageCounter polish", () => {
  const src = read("src/components/StageCounter.tsx");

  test("− and + sit at opposite ends of the controls cluster", () => {
    expect(src).toMatch(/flex items-center justify-between gap-2/);
  });

  test("counter buttons support long-press repeat", () => {
    expect(src).toMatch(/repeat\?:\s*boolean/);
    expect(src).toMatch(/setInterval\(\(\) => onClickRef\.current\(\), 90\)/);
    expect(src).toMatch(/onPointerDown=\{startHold\}/);
    expect(src).toMatch(/onPointerUp=\{stopHold\}/);
    // Both ± pass repeat.
    const repeatProps = src.match(/\brepeat\b\s*\/?>?/g) ?? [];
    expect(repeatProps.length).toBeGreaterThanOrEqual(2);
  });

  test("tap-number-to-type: value renders as an editor with a number input", () => {
    expect(src).toContain("function ValueEditor");
    expect(src).toMatch(/type="number"/);
    expect(src).toMatch(/inputMode="numeric"/);
    // Commit on Enter / blur, cancel on Escape.
    expect(src).toMatch(/e\.key === "Enter"/);
    expect(src).toMatch(/e\.key === "Escape"/);
    expect(src).toMatch(/onSet\(Math\.max\(0, n\)\)/);
  });

  test("uses the optimistic setCounter path with revert-on-error", () => {
    expect(src).toMatch(/import \{ bumpCounter, setCounter \}/);
    expect(src).toMatch(/await setCounter\(\{ projectId: current\.id, stage, value \}\)/);
  });
});

describe("M6 step 4 — setCounter action cascade-validates", () => {
  const src = read("src/lib/actions/counters.ts");

  test("setCounter sets an absolute value, guarded by validateSetValue", () => {
    expect(src).toMatch(/export async function setCounter/);
    expect(src).toMatch(/function validateSetValue/);
    // Cascade neighbours: upper = next-shallower, lower = next-deeper.
    expect(src).toMatch(/can't exceed/);
    expect(src).toMatch(/can't drop below/);
  });

  test("writes a literal value (not a delta) under a zod-validated bound", () => {
    expect(src).toMatch(/value: z\.number\(\)\.int\(\)\.min\(0\)/);
  });
});
