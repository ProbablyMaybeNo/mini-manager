/**
 * GOLD-STANDARD §10 — LogOutput panel.
 *
 * A bordered terminal panel of `timestamp · [LEVEL] · message` rows.
 * Pins the SSR'd markup (panel frame, per-line grid, dim timestamp,
 * bracketed colour tag, white message, optional border label) + the §10
 * CSS layout + an aria-live log region for assistive tech.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LogOutput, type LogLine } from "@/components/ui/LogOutput";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

function ruleBody(selector: string): string {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  return css.match(re)?.[1] ?? "";
}

const LINES: LogLine[] = [
  { time: "14:00:01", level: "info", message: "Kernel loaded at 0x000000" },
  { time: "14:00:02", level: "okay", message: "Filesystem mounted (Read-Only)" },
  { time: "14:00:05", level: "warn", message: "Temperature sensor not responding" },
  { time: "14:00:12", level: "debug", message: "Scanning for peripherals..." },
  { time: "14:01:00", level: "err", message: "Connection refused by remote host" },
];

function html(props: Parameters<typeof LogOutput>[0]): string {
  return renderToStaticMarkup(createElement(LogOutput, props));
}

describe("§10 — LogOutput markup", () => {
  const out = html({ lines: LINES, label: "SYSTEM" });

  test("renders a bordered .panel log region with aria-live", () => {
    expect(out).toMatch(/class="panel log-output[^"]*"/);
    expect(out).toMatch(/role="log"/);
    expect(out).toMatch(/aria-live="polite"/);
  });

  test("border label slots onto the top edge", () => {
    expect(out).toMatch(/class="panel-label"/);
    expect(out).toContain("SYSTEM");
  });

  test("one .log-line per entry with time, tag + message", () => {
    const rows = out.match(/class="log-line"/g) ?? [];
    expect(rows.length).toBe(LINES.length);
    expect(out).toContain("14:00:01");
    expect(out).toContain("Kernel loaded at 0x000000");
  });

  test("level tags render the bracketed §10 set", () => {
    expect(out).toContain("[INFO]");
    expect(out).toContain("[OKAY]");
    expect(out).toContain("[WARN]");
    expect(out).toContain("[DEBUG]");
    expect(out).toContain("[ERR]");
  });

  test("tags carry the status colour tokens (cyan/green/yellow/red) + cyan-bright debug", () => {
    expect(out).toMatch(/--status-info/);
    expect(out).toMatch(/--status-ok/);
    expect(out).toMatch(/--status-warning/);
    expect(out).toMatch(/--status-danger/);
    expect(out).toMatch(/--color-cyan-bright/);
  });

  test("maxHeight caps the scroll region", () => {
    const capped = html({ lines: LINES, maxHeight: 120 });
    expect(capped).toMatch(/max-height:\s*120px/);
  });
});

describe("§10 — CSS layout", () => {
  test(".log-line is a 3-column mono grid (time · tag · message)", () => {
    const body = ruleBody(".log-line");
    expect(body).toMatch(/display:\s*grid/);
    expect(body).toMatch(/grid-template-columns:\s*auto auto 1fr/);
  });

  test(".log-line-time is dim + tabular; .log-line-msg is white", () => {
    expect(ruleBody(".log-line-time")).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(ruleBody(".log-line-msg")).toMatch(/color:\s*var\(--color-fg\)/);
  });
});
