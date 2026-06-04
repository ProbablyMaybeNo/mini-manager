import { describe, expect, test } from "vitest";
import { parseJsonList } from "@/lib/imports/jsonParser";

describe("jsonParser.parseJsonList — simple list shape", () => {
  test("parses { name, units:[{ name, models }] }", () => {
    const raw = JSON.stringify({
      name: "Goff Waaagh!",
      units: [
        { name: "Warboss", models: 1 },
        { name: "Boyz", models: 20 },
      ],
    });
    const result = parseJsonList(raw);
    expect(result.tree.armyName).toBe("Goff Waaagh!");
    expect(result.tree.units).toEqual([
      { name: "Warboss", count: 1 },
      { name: "Boyz", count: 20 },
    ]);
    expect(result.confidence).toBe(0.95);
    expect(result.warnings).toHaveLength(0);
  });

  test("honours count, points and faction aliases", () => {
    const raw = JSON.stringify({
      armyName: "Ultramarines",
      faction: "Adeptus Astartes",
      totalPoints: 2000,
      units: [{ name: "Intercessors", count: 10, points: 200 }],
    });
    const result = parseJsonList(raw);
    expect(result.tree.faction).toBe("Adeptus Astartes");
    expect(result.tree.totalPoints).toBe(2000);
    expect(result.tree.units[0]).toEqual({
      name: "Intercessors",
      count: 10,
      points: 200,
    });
  });

  test("defaults missing count to 1 and clamps to range", () => {
    const raw = JSON.stringify({
      name: "Characters",
      units: [{ name: "Captain" }, { name: "Horde", models: 50000 }],
    });
    const result = parseJsonList(raw);
    expect(result.tree.units[0]?.count).toBe(1);
    expect(result.tree.units[1]?.count).toBe(9999);
  });

  test("coerces numeric strings for count and points", () => {
    const raw = JSON.stringify({
      name: "Stringy",
      units: [{ name: "Boyz", models: "20", points: "180" }],
    });
    const result = parseJsonList(raw);
    expect(result.tree.units[0]).toEqual({
      name: "Boyz",
      count: 20,
      points: 180,
    });
  });

  test("skips nameless units and warns", () => {
    const raw = JSON.stringify({
      name: "Partial",
      units: [{ name: "Boyz", models: 10 }, { models: 5 }],
    });
    const result = parseJsonList(raw);
    expect(result.tree.units).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("no name"))).toBe(true);
  });
});

describe("jsonParser.parseJsonList — app export (v3) shape", () => {
  test("extracts first Army and its Unit children by parentId", () => {
    const raw = JSON.stringify({
      __exportVersion: 3,
      __exportedAt: "2026-06-04T00:00:00.000Z",
      projects: [
        {
          id: "army1",
          type: "Army",
          name: "Hammers of Sigmar",
          faction: "Stormcast Eternals",
          pointsValue: 2000,
        },
        {
          id: "u1",
          type: "Unit",
          parentId: "army1",
          name: "Liberators",
          count: 10,
          pointsValue: 200,
        },
        {
          id: "u2",
          type: "Unit",
          parentId: "army1",
          name: "Vindictors",
          count: 10,
        },
        // a Unit belonging to a different army — must be ignored
        { id: "u3", type: "Unit", parentId: "army2", name: "Other", count: 5 },
      ],
      recipes: [],
      recipeSlots: [],
      palettes: [],
      inventoryEntries: [],
      wishlistItems: [],
    });
    const result = parseJsonList(raw);
    expect(result.tree.armyName).toBe("Hammers of Sigmar");
    expect(result.tree.faction).toBe("Stormcast Eternals");
    expect(result.tree.totalPoints).toBe(2000);
    expect(result.tree.units).toEqual([
      { name: "Liberators", count: 10, points: 200 },
      { name: "Vindictors", count: 10 },
    ]);
    expect(result.confidence).toBe(0.95);
  });

  test("falls back to standalone Unit rows when no Army container", () => {
    const raw = JSON.stringify({
      __exportVersion: 3,
      projects: [
        { id: "u1", type: "Unit", name: "Warriors", count: 20 },
        { id: "u2", type: "Unit", name: "Nobz", count: 5 },
      ],
    });
    const result = parseJsonList(raw);
    expect(result.tree.units).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes("standalone"))).toBe(true);
  });
});

describe("jsonParser.parseJsonList — error handling", () => {
  test("invalid JSON returns confidence 0 with a warning", () => {
    const result = parseJsonList("{ not json");
    expect(result.confidence).toBe(0);
    expect(result.tree.units).toHaveLength(0);
    expect(result.warnings[0]).toContain("Invalid JSON");
  });

  test("non-object root is rejected", () => {
    const result = parseJsonList("[1, 2, 3]");
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toContain("must be an object");
  });

  test("structurally valid but empty reports a no-units warning", () => {
    const result = parseJsonList(JSON.stringify({ name: "Empty", units: [] }));
    expect(result.confidence).toBe(0);
    expect(result.warnings).toContain("No units found in the JSON list.");
  });
});
