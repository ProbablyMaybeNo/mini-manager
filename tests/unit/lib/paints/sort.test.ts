import { describe, expect, test } from "vitest";
import { sortPaints, sortModes } from "@/lib/paints/sort";
import type { Paint } from "@/lib/paints/types";

const p = (overrides: Partial<Paint>): Paint => ({
  id: "p1",
  brand: "Citadel",
  line: "Base",
  name: "Macragge Blue",
  type: "Paint",
  hex: "#0E4A8A",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
  ...overrides,
});

describe("sortPaints", () => {
  test("brand mode: brand → line → name", () => {
    const list = [
      p({ id: "1", brand: "Vallejo", line: "Game Color", name: "Wolf Grey" }),
      p({ id: "2", brand: "Citadel", line: "Layer", name: "Calgar Blue" }),
      p({ id: "3", brand: "Citadel", line: "Base", name: "Macragge Blue" }),
      p({ id: "4", brand: "Citadel", line: "Base", name: "Abaddon Black" }),
    ];
    const sorted = sortPaints(list, "brand").map((x) => x.id);
    expect(sorted).toEqual(["4", "3", "2", "1"]);
  });

  test("name mode: alpha by name only", () => {
    const list = [
      p({ id: "1", name: "Z paint" }),
      p({ id: "2", name: "A paint" }),
      p({ id: "3", name: "M paint" }),
    ];
    expect(sortPaints(list, "name").map((x) => x.id)).toEqual(["2", "3", "1"]);
  });

  test("hue mode: red < yellow < blue on the colour wheel", () => {
    const list = [
      p({ id: "blue", hex: "#0E4A8A" }),
      p({ id: "red", hex: "#FF3333" }),
      p({ id: "yellow", hex: "#FFCC33" }),
    ];
    expect(sortPaints(list, "hue").map((x) => x.id)).toEqual([
      "red",
      "yellow",
      "blue",
    ]);
  });

  test("hue mode: greyscale floats to the end", () => {
    const list = [
      p({ id: "grey", hex: "#808080" }),
      p({ id: "blue", hex: "#0E4A8A" }),
    ];
    expect(sortPaints(list, "hue").map((x) => x.id)).toEqual(["blue", "grey"]);
  });

  test("does not mutate the input array", () => {
    const list = [p({ id: "z" }), p({ id: "a" })];
    sortPaints(list, "name");
    expect(list.map((x) => x.id)).toEqual(["z", "a"]);
  });

  test("sortModes enumerates exactly the supported modes", () => {
    expect(sortModes).toEqual(["brand", "hue", "name", "recent"]);
  });
});
