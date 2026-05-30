import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTextList } from "@/lib/imports/textParser";
import {
  extractArmyName,
  extractFaction,
  extractTotalPoints,
  parseUnitLine,
} from "@/lib/imports/textHeuristics";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "armylists",
  "text",
);

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

describe("textHeuristics.parseUnitLine", () => {
  const cases: ReadonlyArray<[string, { name: string; count: number; points?: number } | null]> = [
    ["10x Intercessors", { name: "Intercessors", count: 10 }],
    ["10 x Intercessors", { name: "Intercessors", count: 10 }],
    ["10 Intercessors", { name: "Intercessors", count: 10 }],
    ["Intercessors x10", { name: "Intercessors", count: 10 }],
    ["Tactical Squad (10) - 135pts", { name: "Tactical Squad", count: 10, points: 135 }],
    ["Necron Warriors (20 models, 220pts)", { name: "Necron Warriors", count: 20, points: 220 }],
    ["* Sergeant Vraks (1) — 25pts", { name: "Sergeant Vraks", count: 1, points: 25 }],
    ["- Warboss [80]", { name: "Warboss", count: 1, points: 80 }],
    ["Lieutenant - 65pts", { name: "Lieutenant", count: 1, points: 65 }],
    ["3x Eradicators - 100pts", { name: "Eradicators", count: 3, points: 100 }],
    ["Squighog Boyz x3 [145]", { name: "Squighog Boyz", count: 3, points: 145 }],

    // Negatives — should NOT parse as units
    ["Detachment: Gladius Task Force", null],
    ["Points Limit: 2000", null],
    ["Total: 1550pts", null],
    ["=====", null],
    ["", null],
  ];

  for (const [input, expected] of cases) {
    test(`"${input}" → ${expected ? JSON.stringify(expected) : "null"}`, () => {
      const result = parseUnitLine(input);
      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toEqual(expected);
      }
    });
  }
});

describe("textHeuristics.extractArmyName", () => {
  test("strips ## heading markers", () => {
    expect(extractArmyName(["## My Army", "stuff"])).toBe("My Army");
  });
  test("strips **bold** markers", () => {
    expect(extractArmyName(["**Goff Waaagh!**", "stuff"])).toBe("Goff Waaagh!");
  });
  test("falls back to first non-empty line", () => {
    expect(extractArmyName(["", "Just a list", "more stuff"])).toBe("Just a list");
  });
  test("returns null on empty input", () => {
    expect(extractArmyName([])).toBeNull();
    expect(extractArmyName(["", "  ", "\t"])).toBeNull();
  });
});

describe("textHeuristics.extractTotalPoints", () => {
  test("matches '2000pts'", () => {
    expect(extractTotalPoints("Total 2000pts")).toBe(2000);
  });
  test("matches '1500 points'", () => {
    expect(extractTotalPoints("This list is 1500 points total")).toBe(1500);
  });
  test("matches '[1850]'", () => {
    expect(extractTotalPoints("Army total [1850]")).toBe(1850);
  });
  test("returns null when no points marker", () => {
    expect(extractTotalPoints("just some text without numbers like that")).toBeNull();
  });
});

describe("textHeuristics.extractFaction", () => {
  test("detects Adeptus Astartes over Space Marines (longer match wins by order)", () => {
    expect(extractFaction("Faction: Adeptus Astartes")).toBe("Adeptus Astartes");
  });
  test("detects Orks", () => {
    expect(extractFaction("Goff Waaagh! Faction: Orks")).toBe("Orks");
  });
  test("returns null for unknown factions", () => {
    expect(extractFaction("Some homebrew faction list")).toBeNull();
  });
});

describe("parseTextList against fixtures", () => {
  test("wtc-40k-marines.txt — full WTC tournament format", () => {
    const result = parseTextList(loadFixture("wtc-40k-marines.txt"));
    expect(result.tree.armyName).toBe("Ultramarines Strike Force");
    expect(result.tree.faction).toBe("Adeptus Astartes");
    expect(result.tree.totalPoints).toBe(2000);

    const names = result.tree.units.map((u) => u.name);
    expect(names).toContain("Intercessors");
    expect(names).toContain("Tactical Marines");
    expect(names).toContain("Redemptor Dreadnought");
    expect(result.tree.units.length).toBeGreaterThanOrEqual(8);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  test("newrecruit-aos-stormcast.txt — NewRecruit-style export", () => {
    const result = parseTextList(loadFixture("newrecruit-aos-stormcast.txt"));
    expect(result.tree.armyName).toContain("Stormcast Eternals");
    expect(result.tree.faction).toBe("Stormcast Eternals");
    expect(result.tree.totalPoints).toBe(2000);

    const liberators = result.tree.units.filter((u) => u.name === "Liberators");
    expect(liberators).toHaveLength(2);
    expect(liberators[0]!.count).toBe(10);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  test("goonhammer-40k-orks.txt — community format with bracket points", () => {
    const result = parseTextList(loadFixture("goonhammer-40k-orks.txt"));
    expect(result.tree.armyName).toBe("Goff Waaagh!");
    expect(result.tree.faction).toBe("Orks");
    expect(result.tree.totalPoints).toBe(1990);

    const boyz = result.tree.units.filter((u) => u.name === "Boyz");
    expect(boyz).toHaveLength(2);
    expect(boyz[0]!.count).toBe(20);
    expect(boyz[0]!.points).toBe(180);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test("hand-typed-trench-crusade.txt — informal hand-typed list", () => {
    const result = parseTextList(loadFixture("hand-typed-trench-crusade.txt"));
    expect(result.tree.armyName.toLowerCase()).toContain("warband");
    expect(result.tree.units.length).toBeGreaterThanOrEqual(3);
    // Confidence should be moderate — no points / faction detected
    expect(result.confidence).toBeLessThan(0.8);
  });

  test("messy-low-confidence.txt — triggers LLM fallback (confidence < 0.6)", () => {
    const result = parseTextList(loadFixture("messy-low-confidence.txt"));
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("parseTextList edge cases", () => {
  test("empty input yields zero confidence + warning", () => {
    const result = parseTextList("");
    expect(result.confidence).toBe(0);
    expect(result.tree.units).toHaveLength(0);
    expect(result.warnings[0]).toBe("Empty input");
  });

  test("whitespace-only input yields zero confidence", () => {
    const result = parseTextList("   \n  \t  \n  ");
    expect(result.confidence).toBe(0);
  });

  test("confidence is clamped to [0, 1]", () => {
    const result = parseTextList(loadFixture("wtc-40k-marines.txt"));
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
