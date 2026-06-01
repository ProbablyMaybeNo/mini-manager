/**
 * UX-902 — Capped + buttons stay clickable so the cascade error fires.
 *
 * Before this round, the `+` button on BUILD (and any other stage at
 * its cascade ceiling) was rendered with the HTML `disabled` attr.
 * That swallowed the click — nothing happened on press, and the
 * inline red cascade error never fired. Recruits on a fresh project
 * trying to bump BUILD past 0 got zero feedback.
 *
 * Fix: CounterButton now renders `aria-disabled` instead of the HTML
 * `disabled` attribute. The button is visually styled the same
 * (opacity + cursor-not-allowed) but the click still reaches
 * `onBump`, which validates against the cascade and calls
 * `setError` with the human-readable reason ("Build can't exceed
 * Owned (0).").
 *
 * Lock the source-level contract here so a future refactor can't
 * silently re-introduce the HTML `disabled` attribute.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const STAGE_COUNTER = "src/components/StageCounter.tsx";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("CounterButton — uses aria-disabled, not HTML disabled (UX-902)", () => {
  const src = read(STAGE_COUNTER);

  test("the button element renders aria-disabled, not the HTML disabled attribute", () => {
    // Find the CounterButton's <button>. It must NOT carry a bare
    // `disabled={...}` prop (that would block the click) but MUST
    // carry `aria-disabled={...}` instead.
    const buttonBlock = src.match(/<button\b[\s\S]*?>/);
    expect(buttonBlock).not.toBeNull();
    const open = buttonBlock?.[0] ?? "";
    expect(open).not.toMatch(/\sdisabled=/);
    expect(open).toMatch(/aria-disabled=/);
  });

  test("aria-disabled is set to undefined when not capped (clean DOM)", () => {
    // `aria-disabled={disabled || undefined}` means a non-capped button
    // doesn't carry the attribute at all — keeps the DOM tidy and
    // doesn't trip AT users with a stale "disabled" announcement.
    expect(src).toMatch(/aria-disabled=\{disabled\s*\|\|\s*undefined\}/);
  });

  test("capped state still gets the visual disabled treatment", () => {
    expect(src).toMatch(/opacity-40 cursor-not-allowed/);
  });
});

describe("StageCounter — capped attempts surface the cascade error (UX-902)", () => {
  const src = read(STAGE_COUNTER);

  test("onBump still calls setError when validateBump fails", () => {
    // The branch that fires the inline red error on capped attempts.
    // Keep both the validateBump call and the setError sink wired.
    expect(src).toContain("validateBump");
    expect(src).toMatch(/if \(!check\.ok\) \{[\s\S]*?setError\(check\.error\)/);
  });

  test("the inline red alert is still rendered when error is set", () => {
    expect(src).toMatch(/role="alert"[\s\S]*?\{error\}/);
  });
});
