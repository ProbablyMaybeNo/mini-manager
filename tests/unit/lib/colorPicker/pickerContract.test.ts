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
    // UX-908 — Library rows are now MatchResult objects (paint + deltaE)
    // so the call site reads `m.paint.hex` / `m.paint.id`. The contract
    // is unchanged: a library-row click still emits via emitPaint.
    expect(src).toContain("onClick={() => emitPaint(m.paint.hex, m.paint.id)}");
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

describe("ColorPicker — item 3: saturation escape from greyscale", () => {
  const src = read("src/components/ui/ColorPicker.tsx");

  test("saturation has a setter (the latch bug was a read-only `sat`)", () => {
    // The bug: `const [sat] = useState(...)` — seeded from a greyscale
    // slot (s=0) and never settable, so the wheel stayed grey forever.
    expect(src).toContain("const [sat, setSat] = useState<number>(seedHsl.s);");
    expect(src).not.toContain("const [sat] = useState");
  });

  test("renders a Saturation slider wired to setSat", () => {
    expect(src).toContain('id="cp-saturation"');
    expect(src).toContain("onChange={(e) => setSat(Number(e.target.value))}");
    expect(src).toContain('aria-label="Saturation"');
  });

  test("shows a hint at saturation 0 explaining how to get colour back", () => {
    expect(src).toContain("drag saturation up to pick a colour");
  });
});

describe("ColorPicker — item 4: finer pixel wheel (more pixels, less blocky)", () => {
  const src = read("src/components/ui/ColorPicker.tsx");

  test("the wheel rasterises into smaller cells (WHEEL_PX <= 5)", () => {
    // Ross: "more pixels, less blocky." The cell edge shrank from 10 -> 5
    // so the donut is built from many more, smaller squares (crisp pixel
    // art, not chunky blocks).
    expect(src).toMatch(/const WHEEL_PX = 5;/);
    expect(src).not.toContain("const WHEEL_PX = 10;");
  });

  test("hue banding is finer (more steps)", () => {
    expect(src).toContain("const WHEEL_HUE_STEPS = 60;");
    expect(src).not.toContain("const WHEEL_HUE_STEPS = 24;");
  });

  test("ring thickness is expressed in cells so the donut stays a ring", () => {
    expect(src).toContain("const WHEEL_RING_CELLS = 9;");
    expect(src).toContain("radius - WHEEL_PX * WHEEL_RING_CELLS");
  });

  test("behaviour is unchanged — hue still comes from the angle (aria-slider)", () => {
    // The pointer/keyboard handlers compute purely from the angle about the
    // centre, so the finer raster is a pure VISUAL change.
    expect(src).toContain('role="slider"');
    expect(src).toContain("Math.atan2");
    expect(src).toContain('shapeRendering="crispEdges"');
  });
});

describe("SlotList — flat-slot editor surface", () => {
  const src = read("src/components/recipes/SlotList.tsx");

  // v6-4 bug fix — the recipe slot side panel now hosts the FULL
  // ColorPicker tool set (wheel + harmony, library, ΔE match,
  // eyedropper) instead of the bare paints-only list, so the painter's
  // colour tools are present and persist while adding / swapping a paint.
  test("hosts the full ColorPicker (wheel/library/match/eyedropper) for add + swap", () => {
    expect(src).toContain("ColorPicker");
    expect(src).toContain("onPickColor");
    // No longer the flat paints-only list.
    expect(src).not.toContain("PaintSlotPicker");
  });

  test("the side panel forwards the add/edit mode to the picker", () => {
    expect(src).toContain('mode="add-slot"');
    expect(src).toContain('mode="edit-slot"');
    expect(src).toContain("mode={mode}");
  });

  test("library paints persist via paintId, wheel/eyedropper hex via customColorHex", () => {
    expect(src).toContain("paintId: selection.paintId");
    expect(src).toContain("customColorHex: selection.hex");
  });

  test("help microcopy disambiguates Add paint vs swap/layer", () => {
    expect(src).toContain("+ Add paint");
    expect(src).toContain("swap its paint or change the");
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

describe("Server actions — exactly-one paint|hex invariant (R7-001)", () => {
  test("addSlot schema requires exactly one of paintId / customColorHex", () => {
    // The action's schema requires *exactly one* of paintId or
    // customColorHex (refine). Both fields are `.nullish()` so null
    // passes Zod's first stage.
    const src = read("src/lib/actions/recipeSlots.ts");
    expect(src).toContain(
      "Boolean(d.paintId) !== Boolean(d.customColorHex)",
    );
    expect(src).toContain("paintId: z.string().min(1).max(64).nullish()");
    expect(src).toContain("customColorHex: hexSchema.nullish()");
  });

  test("updateSlot accepts paintId / customColorHex (at most one)", () => {
    const src = read("src/lib/actions/recipeSlots.ts");
    expect(src).toContain("paintId: z.string().min(1).max(64).nullish()");
    expect(src).toContain("customColorHex: hexSchema.nullish()");
    expect(src).toContain("!(d.paintId && d.customColorHex)");
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
