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

  test("no signal → defaults to 1 / Single Model", () => {
    expect(inferKitContents("Mysterious Artifact")).toEqual({
      modelCount: 1,
      suggestedType: "Single Model",
    });
  });

  test("count==1 known kit → Single Model", () => {
    // No 1-count entries today; verify via a regex match of 1
    expect(inferKitContents("Imperial Knight x1")).toEqual({
      modelCount: 1,
      suggestedType: "Single Model",
    });
  });
});
