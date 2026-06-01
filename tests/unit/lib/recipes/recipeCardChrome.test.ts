/**
 * P11.7 — RecipeCard chrome polish.
 *
 * Body-type now renders as a colour-coded chip (cyan / amber / purple /
 * green). Attachment label now uses the StatusPill primitive instead of
 * bracket-text chrome. Locks the contract by reading the source.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("RecipeCard chrome — P11.7", () => {
  const src = read("src/components/recipes/RecipeCard.tsx");

  test("BODY_TYPE_CHIP maps infantry/vehicle/monster/terrain to palette chips", () => {
    expect(src).toMatch(/infantry:\s*"type-chip-cyan"/);
    expect(src).toMatch(/vehicle:\s*"type-chip-amber"/);
    expect(src).toMatch(/monster:\s*"type-chip-purple"/);
    expect(src).toMatch(/terrain:\s*"type-chip-green"/);
  });

  test("body-type renders via the `.type-chip` chrome (not legacy frame chrome)", () => {
    expect(src).toContain('clsx("type-chip", bodyChipClass)');
  });

  test("attachment label uses the StatusPill primitive (bracket chrome retired)", () => {
    expect(src).toContain("<StatusPill");
    expect(src).not.toContain('"[ standalone ]"');
    expect(src).not.toContain("`[ ${attachment.label} ]`");
  });

  test("standalone recipes render a neutral StatusPill", () => {
    expect(src).toMatch(/StatusPill status="neutral"[\s\S]*Standalone/);
  });

  test("project attachments use info-cyan, named-model uses purple", () => {
    expect(src).toMatch(
      /status=\{attachment\.kind === "project" \? "info" : "purple"\}/,
    );
  });
});

describe("Recipes index — readability microcopy (P11.7 + P11.12)", () => {
  const src = read("src/app/recipes/page.tsx");

  test("page subheading uses 'colour slot' vocabulary, no zone references", () => {
    expect(src).toMatch(/stack of\s+colour slots/);
    expect(src).not.toMatch(/ordered zones × technique/);
  });

  test("empty-state copy uses 'colour slot' vocabulary", () => {
    // P12.5 updated copy: "click a + slot, pick a paint…" replaces the
    // older "add a colour slot" cue. Both vocabularies count as
    // "colour slot" / "+ slot" surfaces.
    expect(src).toMatch(/colour slot|\+ slot/);
    expect(src).not.toMatch(/pick an infantry zone/);
  });
});
