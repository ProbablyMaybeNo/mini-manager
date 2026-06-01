import { describe, expect, test } from "vitest";
import { parseQuickAdd } from "@/lib/quickAdd";

describe("parseQuickAdd", () => {
  test("unit with trailing x-count → Unit + count", () => {
    expect(parseQuickAdd("Necron Warriors x20")).toEqual({
      name: "Necron Warriors",
      count: 20,
      type: "Unit",
    });
  });

  test("explicit Squad keyword → Unit, count keeps default 1", () => {
    expect(parseQuickAdd("Tactical Squad Alpha")).toEqual({
      name: "Tactical Squad Alpha",
      count: 1,
      type: "Unit",
    });
  });

  test("P13.4 — single-model hint folds into Unit with count=1", () => {
    expect(parseQuickAdd("Sergeant Vraks")).toEqual({
      name: "Sergeant Vraks",
      count: 1,
      type: "Unit",
    });
  });

  test("army keyword → Army with count=0 (parent)", () => {
    expect(parseQuickAdd("Astra Militarum army")).toEqual({
      name: "Astra Militarum",
      count: 0,
      type: "Army",
    });
  });

  test("terrain keyword → Terrain Piece, count=1", () => {
    expect(parseQuickAdd("Ruined Cathedral terrain")).toEqual({
      name: "Ruined Cathedral",
      count: 1,
      type: "Terrain Piece",
    });
  });

  test("× (multiplication sign) variant of count", () => {
    expect(parseQuickAdd("Ork Boyz × 30")).toEqual({
      name: "Ork Boyz",
      count: 30,
      type: "Unit",
    });
  });

  test("count > 1 with no type hint → infers Unit", () => {
    expect(parseQuickAdd("Skinks x10")).toEqual({
      name: "Skinks",
      count: 10,
      type: "Unit",
    });
  });

  test("P13.4 — count of 1 with no type hint defaults to Unit", () => {
    expect(parseQuickAdd("Imperial Knight")).toEqual({
      name: "Imperial Knight",
      count: 1,
      type: "Unit",
    });
  });

  test("whitespace is collapsed", () => {
    expect(parseQuickAdd("  Tactical   Squad   Alpha  ")).toEqual({
      name: "Tactical Squad Alpha",
      count: 1,
      type: "Unit",
    });
  });
});
