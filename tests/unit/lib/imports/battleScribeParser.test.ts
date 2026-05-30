import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseBattleScribeRos,
  parseBattleScribeRosz,
} from "@/lib/imports/battleScribeParser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "armylists",
  "battlescribe",
);

function loadText(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf-8");
}

function loadBuffer(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(FIXTURE_DIR, name));
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

describe("parseBattleScribeRos", () => {
  test("parses the Ultramarines Strike Force fixture end-to-end", async () => {
    const xml = loadText("space-marines-2000pts.ros");
    const result = await parseBattleScribeRos(xml);

    expect(result.tree.armyName).toBe("Ultramarines Strike Force");
    expect(result.tree.faction).toBe("Adeptus Astartes");
    expect(result.tree.totalPoints).toBe(1990);
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  test("model-count sum drives unit count (not the unit's own number attribute)", async () => {
    const xml = loadText("space-marines-2000pts.ros");
    const result = await parseBattleScribeRos(xml);

    const intercessors = result.tree.units.find(
      (u) => u.name === "Intercessor Squad",
    );
    expect(intercessors).toBeDefined();
    expect(intercessors!.count).toBe(10);
    expect(intercessors!.points).toBe(200);

    const terminators = result.tree.units.find(
      (u) => u.name === "Terminator Squad",
    );
    expect(terminators!.count).toBe(5);
    expect(terminators!.points).toBe(185);
  });

  test("single-model entries get count 1 from the unit's own number attribute", async () => {
    const xml = loadText("space-marines-2000pts.ros");
    const result = await parseBattleScribeRos(xml);

    const captain = result.tree.units.find(
      (u) => u.name === "Captain in Terminator Armour",
    );
    expect(captain).toBeDefined();
    expect(captain!.count).toBe(1);

    const dread = result.tree.units.find(
      (u) => u.name === "Redemptor Dreadnought",
    );
    expect(dread!.count).toBe(1);
    expect(dread!.points).toBe(210);
  });

  test("all 7 units in the fixture are emitted", async () => {
    const xml = loadText("space-marines-2000pts.ros");
    const result = await parseBattleScribeRos(xml);

    expect(result.tree.units).toHaveLength(7);
    const names = result.tree.units.map((u) => u.name);
    expect(names).toContain("Captain in Terminator Armour");
    expect(names).toContain("Repulsor Executioner");
    expect(names).toContain("Eradicator Squad");
  });

  test("malformed XML yields zero confidence + warning, never throws", async () => {
    const result = await parseBattleScribeRos("<not> valid </xml>");
    expect(result.confidence).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("missing <roster> element yields zero confidence + warning", async () => {
    const result = await parseBattleScribeRos("<?xml version='1.0'?><other/>");
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toMatch(/<roster>/i);
  });
});

describe("parseBattleScribeRosz", () => {
  test("unzips the .rosz archive and parses the inner .ros", async () => {
    const ab = loadBuffer("space-marines-2000pts.rosz");
    const result = await parseBattleScribeRosz(ab);

    expect(result.tree.armyName).toBe("Ultramarines Strike Force");
    expect(result.tree.faction).toBe("Adeptus Astartes");
    expect(result.tree.units).toHaveLength(7);
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  test("a non-zip buffer surfaces a friendly warning rather than throwing", async () => {
    const ab = new TextEncoder().encode("not a zip").buffer as ArrayBuffer;
    const result = await parseBattleScribeRosz(ab);
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toMatch(/rosz archive/i);
  });
});
