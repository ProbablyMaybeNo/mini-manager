/**
 * PHASE-1 — CircularProgress dial primitive.
 *
 * The recurring moodboard "circular gauge" (DESIGN_LANGUAGE §7.1). A pure,
 * SSR-safe SVG ring used for the HEADLINE progress figure (completion /
 * streak) on dashboard panels — dense table rows keep the linear
 * ProgressBar. These tests pin:
 *   - the accessible progressbar contract (role + aria values, clamped),
 *   - the auto-tone threshold set (mirrors the locked ProgressBar set:
 *     neutral 0 / danger <25 / warning 25–74 / ok ≥75),
 *   - the centre readout (percent by default, or an explicit label),
 *   - SSR-safety (no refs / window in the source).
 */
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { CircularProgress } from "@/components/ui/CircularProgress";

function render(props: Parameters<typeof CircularProgress>[0]): string {
  return renderToStaticMarkup(createElement(CircularProgress, props));
}

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("CircularProgress — accessible progressbar contract", () => {
  test("exposes role=progressbar with clamped aria values", () => {
    const html = render({ percent: 42 });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  test("clamps out-of-range percent to 0–100", () => {
    expect(render({ percent: -10 })).toContain('aria-valuenow="0"');
    expect(render({ percent: 150 })).toContain('aria-valuenow="100"');
  });

  test("honours an explicit aria-label", () => {
    const html = render({ percent: 50, ariaLabel: "Half done" });
    expect(html).toContain('aria-label="Half done"');
  });
});

describe("CircularProgress — centre readout", () => {
  test("renders the rounded percent by default", () => {
    expect(render({ percent: 63.6 })).toContain("64%");
  });

  test("renders an explicit label + caption (e.g. a streak count)", () => {
    const html = render({
      percent: 100,
      label: "12",
      caption: "days",
      ariaLabel: "12 day streak",
    });
    expect(html).toContain("12");
    expect(html).toContain("days");
  });

  test("draws no fill arc at 0% (track only)", () => {
    // The fill <circle> is conditional on clamped > 0; an empty dial shows
    // only the track. drop-shadow filter is the fill-only marker.
    expect(render({ percent: 0 })).not.toContain("drop-shadow");
    expect(render({ percent: 1 })).toContain("drop-shadow");
  });
});

describe("CircularProgress — auto tone threshold set (Ross's locked set)", () => {
  test("source maps the behind/mid/ahead thresholds to phosphor hues", () => {
    const src = read("src/components/ui/CircularProgress.tsx");
    expect(src).toContain("clamped >= 75");
    expect(src).toContain("clamped >= 25");
    expect(src).toContain('"danger"');
    expect(src).toContain('"warning"');
    expect(src).toContain('"ok"');
    expect(src).toContain('"neutral"');
  });
});

describe("CircularProgress — SSR-safe", () => {
  const src = read("src/components/ui/CircularProgress.tsx");

  test("is a pure component (no client hooks / window access)", () => {
    expect(src).not.toContain("useEffect");
    expect(src).not.toContain("useRef");
    expect(src).not.toContain('"use client"');
    // No window/document ACCESS (member reads) — a prose mention in the
    // docstring is fine; what matters is the runtime can't touch them.
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/\bdocument\./);
  });

  test("uses token colours, never a raw tailwind grey palette", () => {
    expect(src).not.toMatch(/(?:bg|text|stroke)-(?:gray|slate|zinc|neutral)-\d/);
    expect(src).toContain("var(--status-ok)");
  });
});

describe("DashboardKpiStrip wires the dial into headline KPIs", () => {
  const src = read("src/components/dashboard/DashboardKpiStrip.tsx");

  // PHASE-1 viz — the headline dial swapped CircularProgress for the
  // bespoke ticked + glowing RadialGauge (DESIGN_LANGUAGE §13). The plain
  // CircularProgress is retained as a primitive but no longer wired here.
  test("renders the RadialGauge dial when a card supplies one", () => {
    expect(src).toContain("RadialGauge");
    expect(src).toContain("card.dial");
  });
});
