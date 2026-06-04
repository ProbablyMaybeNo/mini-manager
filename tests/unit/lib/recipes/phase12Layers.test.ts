/**
 * P12.3 — Phase-12 layer assignment.
 *
 * The recipe slot grid's filled-slot click now opens the side panel
 * with a LayerSelector above the ColorPicker. The selector enumerates
 * Ross's locked layer set (undercoat / basecoat / midcoat / highlight
 * / edge_highlight / wash / detail / metallic). Picking a layer fires
 * updateStep against the slot's first step.
 *
 * These tests pin the schema-level enum + the visible LayerSelector
 * surface so a future grep can't drag the layer set back to the old
 * technique-key vocabulary (drybrush / glaze / two_thin_coats etc.)
 * which is retained only for back-compat with existing recipes.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  phase12LayerKeys,
  phase12LayerLabel,
  techniqueKeys,
  type Phase12LayerKey,
  type TechniqueKey,
} from "@/db/schema";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("Phase-12 layer set (schema)", () => {
  test("the locked 8 layers are exposed in phase12LayerKeys", () => {
    expect([...phase12LayerKeys].sort()).toEqual(
      [
        "basecoat",
        "detail",
        "edge_highlight",
        "highlight",
        "metallic",
        "midcoat",
        "undercoat",
        "wash",
      ].sort(),
    );
    expect(phase12LayerKeys.length).toBe(8);
  });

  test("phase12LayerKeys is a subset of techniqueKeys (back-compat)", () => {
    const techniques: ReadonlyArray<string> = techniqueKeys;
    for (const layer of phase12LayerKeys) {
      expect(techniques).toContain(layer);
    }
  });

  test("legacy technique keys are retained for back-compat", () => {
    // Existing recipes in the database may have technique=='layer',
    // 'drybrush', 'glaze' etc. These keys MUST stay valid so older
    // recipes keep loading.
    const techniques: ReadonlyArray<string> = techniqueKeys;
    for (const legacy of [
      "layer",
      "drybrush",
      "glaze",
      "stipple",
      "wet_blend",
      "two_thin_coats",
      "zenithal_prime",
    ]) {
      expect(techniques).toContain(legacy);
    }
  });

  test("phase12LayerLabel has a human label for every layer", () => {
    for (const key of phase12LayerKeys) {
      const label = phase12LayerLabel[key as Phase12LayerKey];
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    }
    // Specific locked labels Ross uses:
    expect(phase12LayerLabel.edge_highlight).toBe("Edge highlight");
    expect(phase12LayerLabel.basecoat).toBe("Basecoat");
    expect(phase12LayerLabel.midcoat).toBe("Midcoat");
    expect(phase12LayerLabel.metallic).toBe("Metallic");
  });

  test("the techniqueKeys union still treats Phase-12 layers as valid", () => {
    const keys: ReadonlyArray<TechniqueKey> = techniqueKeys;
    const has = (k: TechniqueKey) => keys.includes(k);
    expect(has("undercoat")).toBe(true);
    expect(has("midcoat")).toBe(true);
    expect(has("detail")).toBe(true);
    expect(has("metallic")).toBe(true);
  });
});

describe("SlotList — LayerSelector + chip wiring (flat model)", () => {
  const src = read("src/components/recipes/SlotList.tsx");

  test("imports the phase12 layer set from the schema", () => {
    expect(src).toContain("phase12LayerKeys");
    expect(src).toContain("phase12LayerLabel");
  });

  test("LayerSelector enumerates phase12LayerKeys (not techniqueKeys)", () => {
    expect(src).toMatch(/phase12LayerKeys\.map/);
  });

  test("the slot cell renders the layer name via layerDisplay", () => {
    // The visible chip uses phase12LayerLabel[…] when the slot's
    // technique is in the locked set; legacy values fall back to the
    // raw key (with underscores stripped) so older recipes still read.
    expect(src).toContain("phase12LayerLabel[key]");
    expect(src).toContain("isPhase12Layer");
    expect(src).toContain("layerDisplay(slot.technique)");
  });

  test("SlotListItem carries the slot technique", () => {
    expect(src).toMatch(/technique:\s*TechniqueKey/);
  });

  test("LayerSelector wires updateSlot with the new technique", () => {
    expect(src).toContain("handleLayerSelect");
    expect(src).toContain("technique: layer");
  });
});

describe("Recipe editor page maps the slot technique into SlotListItem", () => {
  test("the page wires technique into the SlotListItem", () => {
    const src = read("src/app/recipes/[id]/page.tsx");
    expect(src).toContain("technique: slot.technique");
  });
});
