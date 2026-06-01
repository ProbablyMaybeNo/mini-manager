/**
 * R7-001 + R7-002 — ColorPicker contract pin.
 *
 * The auditor caught that wheel selections silently dropped because the
 * picker emitted `{ hex }` (no paintId field) and downstream consumers
 * sometimes conflated `undefined` with "use the existing paintId". The
 * R7-001 fix pins the contract:
 *
 *   - library row → `{ hex, paintId: <id> }`
 *   - wheel / harmony / eyedropper → `{ hex, paintId: null }`
 *
 * R7-002 introduces a `mode: 'add-slot' | 'edit-slot'` prop so the
 * painter is never ambiguous about whether picking a colour creates a
 * new slot or replaces the existing one's paint. The picker renders a
 * one-line hint at the top reflecting the mode.
 *
 * We assert the contract by reading the source text (same pattern as
 * zoneListLabels.test.ts) — the components are `'use client'` modules
 * with transitive server-action imports that crash a Node-only test
 * environment.
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

describe("ColorPicker — R7-001 emit contract", () => {
  const src = read("src/components/ui/ColorPicker.tsx");

  test("wheel/harmony/eyedropper use `emitHex` which pins paintId: null", () => {
    // The helper makes the "raw hex, no library paint" intent explicit
    // on the wire. Verbatim string match prevents a refactor from
    // silently going back to `{ hex }` without `paintId`.
    expect(src).toContain("const emitHex = (hex: string) => {");
    expect(src).toContain('onSelect({ hex, paintId: null });');
  });

  test("library row uses `emitPaint` which keeps paintId set", () => {
    expect(src).toContain(
      "const emitPaint = (hex: string, paintId: string) => {",
    );
    expect(src).toContain("onSelect({ hex, paintId });");
  });

  test("wheel 'Use this colour' button is wired to emitHex", () => {
    expect(src).toContain("onClick={() => emitHex(pickedHex)}");
  });

  test("harmony swatches are wired to emitHex", () => {
    expect(src).toContain("onClick={() => emitHex(hex)}");
    // No bare `emit({ hex })` calls survive.
    expect(src).not.toMatch(/emit\(\{\s*hex\s*\}\)/);
  });

  test("library row is wired to emitPaint with paint.id", () => {
    expect(src).toContain("onClick={() => emitPaint(paint.hex, paint.id)}");
  });

  test("no callsite emits a selection without a paintId field", () => {
    // Belt + braces — the old `emit({ hex })` and
    // `emit({ hex, paintId: paint.id })` shapes are both gone in
    // favour of the two named helpers.
    expect(src).not.toMatch(/emit\(\{\s*hex:/);
  });
});

describe("ColorPicker — R7-002 mode prop", () => {
  const src = read("src/components/ui/ColorPicker.tsx");

  test("Props accept a `mode` of type ColorPickerMode", () => {
    expect(src).toContain("mode?: ColorPickerMode;");
  });

  test("mode defaults to 'add-slot' for back-compat with pre-R7 consumers", () => {
    expect(src).toContain('mode = "add-slot",');
  });

  test("mode hint renders REPLACES copy in edit-slot mode", () => {
    expect(src).toContain(
      `"Picking a colour REPLACES this slot's paint."`,
    );
  });

  test("mode hint renders ADDS copy in add-slot mode", () => {
    expect(src).toContain('"Picking a colour ADDS a new slot."');
  });

  test("mode hint is reachable via data-testid for downstream e2e", () => {
    expect(src).toContain('data-testid="picker-mode-hint"');
  });
});

describe("ZoneList — R7-002 passes the right mode through", () => {
  const src = read("src/components/recipes/ZoneList.tsx");

  test("'new' picker target maps to add-slot, 'edit' to edit-slot", () => {
    expect(src).toContain(
      'mode={pickerTarget.kind === "new" ? "add-slot" : "edit-slot"}',
    );
  });

  test("the inner ColorPickerSidePanel forwards mode to ColorPicker", () => {
    expect(src).toContain("mode: ColorPickerMode;");
    expect(src).toContain("mode={mode}");
  });

  test("help microcopy disambiguates ADD vs REPLACE vs layer", () => {
    expect(src).toContain("slot to ADD a new colour");
    expect(src).toContain("REPLACE its");
    expect(src).toContain("+ Add step");
  });
});

describe("ProjectColorSchemeBox — R7-002 passes the right mode through", () => {
  const src = read("src/components/ProjectColorSchemeBox.tsx");

  test("scheme picker forwards mode based on the picker target kind", () => {
    expect(src).toContain(
      'mode={pickerTarget.kind === "new" ? "add-slot" : "edit-slot"}',
    );
  });

  test("the local ColorPickerSidePanel forwards mode to ColorPicker", () => {
    expect(src).toContain("mode: ColorPickerMode;");
    expect(src).toContain("mode={mode}");
  });
});

describe("Server actions — accept the {hex, paintId: null} shape (R7-001)", () => {
  test("addSlotWithPaint schema accepts paintId=null + customColorHex=<hex>", () => {
    // The action's schema requires *exactly one* of paintId or
    // customColorHex. The consumer (ZoneList / ProjectColorSchemeBox)
    // translates a `paintId: null` selection into
    // `{ paintId: null, customColorHex: selection.hex }`. Verify the
    // schema's refine() allows this.
    const src = read("src/lib/actions/recipeZones.ts");
    expect(src).toContain(
      "Boolean(d.paintId) !== Boolean(d.customColorHex)",
    );
    // Both fields are `.nullish()` so null passes Zod's first stage.
    expect(src).toContain("paintId: z.string().min(1).max(64).nullish()");
    expect(src).toContain("customColorHex: hexShape.nullish()");
  });

  test("updateStep accepts paintId=null + customColorHex=<hex>", () => {
    const src = read("src/lib/actions/recipeSteps.ts");
    expect(src).toContain("paintId: z.string().min(1).max(64).nullish()");
    expect(src).toContain("customColorHex: hexSchema.nullish()");
  });
});

describe("ColorPickerSelection type — R7-001 explicit null", () => {
  const src = read("src/lib/colorPicker/types.ts");

  test("paintId is typed string | null (not just optional string)", () => {
    expect(src).toContain("paintId?: string | null;");
  });

  test("ColorPickerMode is exported as a discriminated union", () => {
    expect(src).toContain('export type ColorPickerMode = "add-slot" | "edit-slot";');
  });
});
