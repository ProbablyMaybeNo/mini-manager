import { describe, expect, test } from "vitest";
import { inferKitContents } from "@/lib/wishlist/kitInference";

describe("inferKitContents", () => {
  test("known kit name → curated count", () => {
    expect(inferKitContents("Necron Warriors box")).toEqual({
      modelCount: 20,
      suggestedType: "Unit",
    });
  });

  test("Combat Patrol → 30", () => {
    expect(inferKitContents("Space Marines Combat Patrol")).toMatchObject({
      modelCount: 30,
      suggestedType: "Unit",
    });
  });

  test("regex fallback: trailing x10", () => {
    expect(inferKitContents("Random Squad x10")).toMatchObject({
      modelCount: 10,
      suggestedType: "Unit",
    });
  });

  test("regex fallback: '10 Intercessors'", () => {
    // 'Intercessors' is a known kit (10) — this also matches the fallback
    // — either way the result should be 10/Unit.
    expect(inferKitContents("10 Intercessors")).toMatchObject({
      modelCount: 10,
      suggestedType: "Unit",
    });
  });

  test("regex fallback: 'Set of 24'", () => {
    expect(inferKitContents("Set of 24 Termagants")).toMatchObject({
      modelCount: 24,
      suggestedType: "Unit",
    });
  });

  test("P13.4 — no signal defaults to 1 / Unit (was Single Model pre-P13.4)", () => {
    expect(inferKitContents("Mysterious Artifact")).toEqual({
      modelCount: 1,
      suggestedType: "Unit",
    });
  });

  test("P13.4 — count==1 still folds to Unit", () => {
    expect(inferKitContents("Imperial Knight x1")).toEqual({
      modelCount: 1,
      suggestedType: "Unit",
    });
  });
});
