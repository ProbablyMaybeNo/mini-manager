/**
 * P13.6 — Gradient + Match colour cells are click-targets that open
 * the ColorPicker primitive. Source-level test: confirms the swatch
 * preview elements are `<button>`s with the picker-open handler wired,
 * and that MatchResultsRow accepts an `onPickColor` callback used by
 * MatchClient to reseed the target.
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

describe("P13.6 — Match target swatch is a clickable picker trigger", () => {
  const src = read("src/components/tools/match/MatchClient.tsx");

  test("the 10x10 target preview is a <button> with onClick=setPickerOpen", () => {
    // Locate the target preview block; it must be a <button>, not a <span>.
    expect(src).toMatch(
      /<button[\s\S]*?aria-label="Open colour picker for match target"[\s\S]*?onClick=\{\(\) => setPickerOpen\(true\)\}/,
    );
  });

  test("the target preview keeps keyboard focus styling (focus:ring)", () => {
    expect(src).toMatch(/focus:ring-2 focus:ring-\[var\(--color-accent\)\]/);
  });

  test("the ColorPickerDialog still mounts from setPickerOpen", () => {
    expect(src).toContain("<ColorPickerDialog");
    expect(src).toContain("open={pickerOpen}");
  });
});

describe("P13.6 — Match result swatches reseed the target via picker", () => {
  const rowSrc = read("src/components/tools/match/MatchResultsRow.tsx");
  const clientSrc = read("src/components/tools/match/MatchClient.tsx");

  test("MatchResultsRow exposes an onPickColor prop", () => {
    expect(rowSrc).toMatch(/onPickColor\?:\s*\(hex:\s*string\)\s*=>\s*void/);
  });

  test("MatchResultsRow renders the swatch as a <button> when onPickColor is provided", () => {
    expect(rowSrc).toMatch(/onPickColor\s*\?\s*\([\s\S]*?<button/);
    expect(rowSrc).toMatch(/onClick=\{\(\)\s*=>\s*onPickColor\(paint\.hex\)\}/);
  });

  test("MatchClient wires onPickColor to open the picker pre-seeded with the chosen hex", () => {
    expect(clientSrc).toMatch(/onPickColor=\{handleResultPickColor\}/);
    expect(clientSrc).toMatch(/handleResultPickColor[\s\S]*?setPickerOpen\(true\)/);
  });
});

describe("P13.6 — Gradient colour cells open the picker on click", () => {
  const src = read("src/components/tools/gradient/GradientClient.tsx");

  test("each ColorInput swatch preview is now a <button onClick=onOpenPicker>", () => {
    // The 9x9 swatch inside ColorInput is now a <button>.
    expect(src).toMatch(
      /<button[\s\S]*?aria-label=\{`Open colour picker for \$\{label\.toLowerCase\(\)\}`\}[\s\S]*?onClick=\{onOpenPicker\}/,
    );
  });

  test("the ColorPickerDialog mounts with pickerLane state (shadow/base/highlight)", () => {
    expect(src).toContain("<ColorPickerDialog");
    expect(src).toContain("pickerLane");
  });
});
