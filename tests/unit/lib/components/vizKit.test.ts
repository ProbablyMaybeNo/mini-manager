/**
 * batch/viz-kit-dashboard — bespoke SVG data-viz kit (DESIGN_LANGUAGE §13).
 *
 * The hand-built HUD viz components under src/components/viz. These tests
 * pin the SSR-render contract (each renders to deterministic markup in
 * Node), the accessible role/label contract, the token-colour discipline
 * (no raw tailwind greys, phosphor tokens only), and SSR-safety (no client
 * hooks / window / document access). Pixel look is reviewed by eye.
 */
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { RadialGauge } from "@/components/viz/RadialGauge";
import { LineGraph, AreaGraph } from "@/components/viz/LineGraph";
import { Sparkline } from "@/components/viz/Sparkline";
import { SegmentedBar } from "@/components/viz/SegmentedBar";
import { WireframeGlobe } from "@/components/viz/WireframeGlobe";
import { resolveAutoTone } from "@/components/viz/vizTokens";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

/* ============================================================
   RadialGauge
   ============================================================ */
describe("RadialGauge — accessible dial contract", () => {
  const render = (p: Parameters<typeof RadialGauge>[0]) =>
    renderToStaticMarkup(createElement(RadialGauge, p));

  test("exposes role=progressbar with clamped aria values", () => {
    const html = render({ value: 42 });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  test("derives the percent from value/max", () => {
    expect(render({ value: 3, max: 12 })).toContain('aria-valuenow="25"');
  });

  test("clamps out-of-range to 0–100", () => {
    expect(render({ value: -5 })).toContain('aria-valuenow="0"');
    expect(render({ value: 999 })).toContain('aria-valuenow="100"');
  });

  test("renders the rounded percent by default, or an explicit label", () => {
    expect(render({ value: 63.6 })).toContain("64%");
    const html = render({ value: 100, label: "12", caption: "days" });
    expect(html).toContain("12");
    expect(html).toContain("days");
  });

  test("renders tick marks (the dial graduations) and a tech label", () => {
    const html = render({ value: 50, ticks: 8, techLabel: "AVG ▸ 60D" });
    expect(html).toContain("<line");
    expect(html).toContain("AVG ▸ 60D");
  });

  test("draws no value arc at 0% (track only)", () => {
    // The arc carries the drop-shadow glow filter; an empty dial has none.
    expect(render({ value: 0 })).not.toContain("drop-shadow");
    expect(render({ value: 1 })).toContain("drop-shadow");
  });

  test("honours an explicit aria-label", () => {
    expect(render({ value: 50, ariaLabel: "Half done" })).toContain(
      'aria-label="Half done"',
    );
  });
});

/* ============================================================
   LineGraph / AreaGraph
   ============================================================ */
describe("LineGraph / AreaGraph", () => {
  const render = (p: Parameters<typeof LineGraph>[0]) =>
    renderToStaticMarkup(createElement(LineGraph, p));

  test("renders an accessible img with the supplied label", () => {
    const html = render({ data: [1, 2, 3], ariaLabel: "Activity, 60 days" });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Activity, 60 days"');
  });

  test("draws a plot path + plotted nodes for a multi-point series", () => {
    const html = render({ data: [2, 5, 3, 8], ariaLabel: "trend" });
    expect(html).toContain("<path");
    expect(html).toContain("<circle"); // node dots (readability floor)
  });

  test("renders the empty grid only for an empty series (no path)", () => {
    const html = render({ data: [], ariaLabel: "empty" });
    expect(html).toContain("<line"); // grid rules still draw
    expect(html).not.toContain("<path");
  });

  test("AreaGraph emits the low-alpha area gradient fill", () => {
    const html = renderToStaticMarkup(
      createElement(AreaGraph, { data: [1, 4, 2, 6], ariaLabel: "area" }),
    );
    expect(html).toContain("linearGradient");
    expect(html).toContain("url(#viz-area-cyan)");
  });

  test("a flat series does not collapse to the floor (centres on mid-line)", () => {
    // span === 0 → all nodes at mid; the path must still render without NaN.
    const html = render({ data: [5, 5, 5], ariaLabel: "flat" });
    expect(html).toContain("<path");
    expect(html).not.toContain("NaN");
  });
});

/* ============================================================
   Sparkline
   ============================================================ */
describe("Sparkline", () => {
  const render = (p: Parameters<typeof Sparkline>[0]) =>
    renderToStaticMarkup(createElement(Sparkline, p));

  test("renders an accessible img with the supplied label", () => {
    const html = render({ data: [1, 3, 2, 5], ariaLabel: "Streak trend" });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Streak trend"');
  });

  test("draws a trace + glowing end-dot for a multi-point series", () => {
    const html = render({ data: [1, 3, 2, 5], ariaLabel: "t" });
    expect(html).toContain("<path");
    expect(html).toContain("<circle");
  });

  test("renders a flat baseline (no path) for a single/empty series", () => {
    expect(render({ data: [], ariaLabel: "t" })).toContain("<line");
    expect(render({ data: [7], ariaLabel: "t" })).toContain("<line");
  });
});

/* ============================================================
   SegmentedBar
   ============================================================ */
describe("SegmentedBar — segmented (non-smooth) progress", () => {
  const render = (p: Parameters<typeof SegmentedBar>[0]) =>
    renderToStaticMarkup(createElement(SegmentedBar, p));

  test("exposes role=progressbar with clamped aria values", () => {
    const html = render({ value: 60 });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="60"');
  });

  test("renders exactly `segments` cells", () => {
    const html = render({ value: 50, segments: 8 });
    // Each cell is a <span aria-hid="true"> with a flex-1 box.
    const cells = html.match(/min-w-\[3px\]/g) ?? [];
    expect(cells.length).toBe(8);
  });

  test("a non-zero value always lights at least one cell", () => {
    // 1% across 10 cells should still light the first (never invisible).
    const html = render({ value: 1, segments: 10, animate: false });
    expect(html).toContain("color-mix"); // a lit cell carries the fill
  });

  test("renders the color-bar-with-black-text readout chip", () => {
    const html = render({ value: 62, readout: "62%", label: "OUTPUT RATE" });
    expect(html).toContain("OUTPUT RATE");
    expect(html).toContain("62%");
    expect(html).toContain("var(--color-bg)"); // black text on the fill
  });
});

/* ============================================================
   WireframeGlobe — the signature dashboard radar hero
   ============================================================ */
describe("WireframeGlobe — accessible radar-scope hero", () => {
  const render = (p?: Parameters<typeof WireframeGlobe>[0]) =>
    renderToStaticMarkup(createElement(WireframeGlobe, p ?? {}));

  test("renders an accessible img with a default label", () => {
    const html = render();
    expect(html).toContain('role="img"');
    expect(html).toContain("aria-label=");
  });

  test("honours an explicit aria-label", () => {
    expect(render({ ariaLabel: "Mission radar" })).toContain(
      'aria-label="Mission radar"',
    );
  });

  test("renders a complete still frame: rim, grid, ticks, sweep, blips", () => {
    const html = render();
    expect(html).toContain("<svg"); // SSR-rendered SVG
    expect(html).toContain("<circle"); // rim + blips
    expect(html).toContain("<ellipse"); // latitude rings + meridians
    expect(html).toContain("<line"); // tick graduations + axes
    expect(html).toContain("<path"); // the radar sweep wedge
    expect(html).toContain("radialGradient"); // the sweep fill
  });

  test("the sweep carries the glow bloom (drop-shadow on the active edge)", () => {
    expect(render()).toContain("drop-shadow");
  });

  test("renders a deterministic count of meridian/latitude rings", () => {
    // 7 meridians + (3 latitudes * 2 mirrored) + 1 equator = 14 ellipses.
    const html = render({ meridians: 7, latitudes: 3 });
    const ellipses = html.match(/<ellipse/g) ?? [];
    expect(ellipses.length).toBe(7 + 3 * 2 + 1);
  });

  test("does not emit NaN coordinates for any geometry", () => {
    expect(render({ size: 200, meridians: 9, latitudes: 4 })).not.toContain(
      "NaN",
    );
  });

  test("animation is opt-out (no infinite animation when animate=false)", () => {
    // The sweep id (`wfg-sweep-cyan`) survives in the gradient defs even when
    // static — assert on the keyframe *application* (the `_8s` / `_2.6s`
    // duration tokens) instead, which only the motion-safe classes carry.
    const html = render({ animate: false });
    expect(html).not.toContain("wfg-sweep_");
    expect(html).not.toContain("wfg-ping_");
    expect(html).not.toContain("motion-safe:");
  });

  test("animation when enabled is motion-safe gated", () => {
    const html = render({ animate: true });
    expect(html).toContain("motion-safe:[animation:wfg-sweep_");
  });
});

/* ============================================================
   Shared tone resolution (the locked completion threshold set)
   ============================================================ */
describe("resolveAutoTone — locked behind/mid/ahead set", () => {
  test("maps 0/<25/25-74/>=75 to neutral/red/amber/green", () => {
    expect(resolveAutoTone("auto", 0)).toBe("neutral");
    expect(resolveAutoTone("auto", 10)).toBe("red");
    expect(resolveAutoTone("auto", 50)).toBe("amber");
    expect(resolveAutoTone("auto", 80)).toBe("green");
  });

  test("concrete tones pass straight through", () => {
    expect(resolveAutoTone("purple", 10)).toBe("purple");
    expect(resolveAutoTone("cyan", 99)).toBe("cyan");
  });
});

/* ============================================================
   Token discipline + SSR-safety (source-level guards)
   ============================================================ */
describe("viz kit — token discipline + SSR-safe", () => {
  const files = [
    "src/components/viz/RadialGauge.tsx",
    "src/components/viz/LineGraph.tsx",
    "src/components/viz/Sparkline.tsx",
    "src/components/viz/SegmentedBar.tsx",
    "src/components/viz/WireframeGlobe.tsx",
    "src/components/viz/vizTokens.ts",
  ];

  test("no raw tailwind grey palette anywhere in the kit", () => {
    for (const f of files) {
      expect(read(f)).not.toMatch(
        /(?:bg|text|stroke|border|fill)-(?:gray|slate|zinc|neutral)-\d/,
      );
    }
  });

  test("components are pure (no client hooks / window / document access)", () => {
    for (const f of files) {
      const src = read(f);
      expect(src).not.toContain("useEffect");
      expect(src).not.toContain("useRef");
      expect(src).not.toContain('"use client"');
      expect(src).not.toMatch(/\bwindow\./);
      expect(src).not.toMatch(/\bdocument\./);
    }
  });

  test("mount animation is motion-safe gated (reduced-motion floor)", () => {
    for (const f of [
      "src/components/viz/RadialGauge.tsx",
      "src/components/viz/LineGraph.tsx",
      "src/components/viz/Sparkline.tsx",
      "src/components/viz/SegmentedBar.tsx",
      "src/components/viz/WireframeGlobe.tsx",
    ]) {
      expect(read(f)).toContain("motion-safe:");
    }
  });
});
