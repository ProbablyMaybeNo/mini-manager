"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/kit";
import { THEME_OVERRIDE_KEY, applyThemeOverrides } from "@/components/dev/ThemeOverrides";

type Tok = { v: string; label: string };

const COLORS: Tok[] = [
  { v: "--color-bg", label: "Background" },
  { v: "--color-bg-raised", label: "Raised surface" },
  { v: "--color-cyan", label: "Cyan" },
  { v: "--color-green", label: "Green" },
  { v: "--color-yellow", label: "Yellow" },
  { v: "--color-purple", label: "Purple" },
  { v: "--color-red", label: "Red" },
  { v: "--color-fg", label: "Foreground" },
  { v: "--color-fg-dim", label: "Foreground dim" },
  { v: "--color-fg-faint", label: "Foreground faint" },
];

/**
 * The 7-category typography taxonomy (locked with Ross 2026-06-20). Each category
 * = one font token + one size token, no cross-category sharing. Buttons reuse the
 * existing --font-button / --text-button. Number 2 defaults to Body 1.
 */
type Cat = {
  key: string;
  label: string;
  desc: string;
  font: string;
  size: string;
  min: number;
  max: number;
};

const CATEGORIES: Cat[] = [
  { key: "title", label: "Title", desc: "Page titles", font: "--font-title", size: "--text-title", min: 16, max: 80 },
  { key: "h1", label: "Header 1", desc: "Section headers · nav · modal titles", font: "--font-h1", size: "--text-h1", min: 10, max: 48 },
  { key: "h2", label: "Header 2", desc: "Column headers · in-section labels", font: "--font-h2", size: "--text-h2", min: 8, max: 32 },
  { key: "body", label: "Body 1", desc: "All regular text · dropdown options · inputs", font: "--font-body", size: "--text-body", min: 8, max: 30 },
  { key: "button", label: "Buttons", desc: "Buttons · chips · status · priority · dropdown trigger", font: "--font-button", size: "--text-button", min: 8, max: 28 },
  { key: "num1", label: "Number 1 · Hero", desc: "Big stat numbers · stopwatch timer", font: "--font-num1", size: "--text-num1", min: 16, max: 100 },
  { key: "num2", label: "Number 2 · Standard", desc: "Calendar · progress % · counters (defaults to Body 1)", font: "--font-num2", size: "--text-num2", min: 8, max: 30 },
];

/** The faces currently loaded in the app (globals.css @font-face / @fontsource). */
const FONT_CHOICES = [
  // New trial faces (Ross, 2026-07-09)
  "Epeldorne",
  "Square Block",
  "Nouveau IBM",
  "Nouveau IBM Stretch",
  "Neon Glow",
  "UAV OSD Sans Mono",
  "Patrick",
  "DEC Terminal",
  // Existing
  "Flexi IBM VGA True",
  "VT323",
  "IBM BIOS",
  "Unbutton",
  "3D Pixel",
  "UAV OSD Mono",
  "DePixel Klein",
  "DePixel Breit",
  "Light Pixel 7",
  "Pixeland",
  "Apricot 256L",
  "IBM XGA-AI",
  "Share Tech Mono",
  "IBM Plex Mono",
  "Courier New",
  "monospace",
];

/** Fallback seeds so sliders/selects seed correctly even before @theme resolves. */
const SIZE_DEFAULT: Record<string, string> = {
  "--text-title": "1.8438rem",
  "--text-h1": "1rem",
  "--text-h2": "0.75rem",
  "--text-body": "0.9688rem",
  "--text-button": "0.75rem",
  "--text-num1": "2.1875rem",
  "--text-num2": "0.9688rem",
};

const ALL_VARS = [
  ...COLORS.map((t) => t.v),
  ...CATEGORIES.map((c) => c.font),
  ...CATEGORIES.map((c) => c.size),
];

const read = (v: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const set = (v: string, value: string) =>
  document.documentElement.style.setProperty(v, value);

const firstFamily = (stack: string) =>
  (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");

const fontStack = (family: string) =>
  family === "monospace" ? "monospace" : `"${family}", "IBM Plex Mono", monospace`;

const remToPx = (rem: string) => Math.round((parseFloat(rem) || 0) * 16);
const pxToRem = (px: number) =>
  `${(px / 16).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}rem`;

export function ThemeStudio() {
  // varName -> current value (colour hex, font stack, or size rem)
  const [vals, setVals] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    applyThemeOverrides();
    const seed: Record<string, string> = {};
    for (const v of ALL_VARS) seed[v] = read(v) || SIZE_DEFAULT[v] || "";
    setVals(seed);
  }, []);

  function persist(next: Record<string, string>) {
    try {
      localStorage.setItem(THEME_OVERRIDE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function update(v: string, value: string) {
    set(v, value);
    setVals((prev) => {
      const next = { ...prev, [v]: value };
      persist(next);
      return next;
    });
    setCopied(false);
  }

  /** Number 2 → match Body 1 (font + size). */
  function matchBody() {
    const next = {
      ...vals,
      "--font-num2": vals["--font-body"] ?? "",
      "--text-num2": vals["--text-body"] ?? "",
    };
    set("--font-num2", next["--font-num2"]);
    set("--text-num2", next["--text-num2"]);
    setVals(next);
    persist(next);
    setCopied(false);
  }

  function reset() {
    for (const v of ALL_VARS) document.documentElement.style.removeProperty(v);
    try {
      localStorage.removeItem(THEME_OVERRIDE_KEY);
    } catch {
      /* ignore */
    }
    const seed: Record<string, string> = {};
    for (const v of ALL_VARS) seed[v] = read(v) || SIZE_DEFAULT[v] || "";
    setVals(seed);
    setCopied(false);
  }

  const cssBlock = useMemo(() => {
    const line = (v: string) => `  ${v}: ${vals[v] ?? ""};`;
    return [
      "@theme {",
      "  /* palette */",
      ...COLORS.map((t) => line(t.v)),
      "",
      "  /* type categories — families */",
      ...CATEGORIES.map((c) => line(c.font)),
      "",
      "  /* type categories — sizes */",
      ...CATEGORIES.map((c) => line(c.size)),
      "}",
    ].join("\n");
  }, [vals]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(cssBlock);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const catStyle = (c: Cat): React.CSSProperties => ({
    fontFamily: `var(${c.font})`,
    fontSize: `var(${c.size})`,
  });
  const cat = (key: string) => CATEGORIES.find((c) => c.key === key)!;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-cyan/40 px-6 py-3">
        <div>
          <h1 className="font-display text-2xl text-cyan text-glow-cyan">Theme Builder · Typography</h1>
          <p className="font-mono text-xs text-fg-dim">
            Dev-only · 7-category font taxonomy. Tune face + size per category and watch the
            preview. Live app is untouched until the migration — copy the @theme block when locked.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={reset}>
            Reset
          </Button>
          <Button variant="add" size="sm" onClick={copy}>
            {copied ? "Copied ✓" : "Copy @theme"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[380px_1fr]">
        {/* ───────────────────────── Controls ───────────────────────── */}
        <div className="flex flex-col gap-6">
          <Section title="Font categories">
            {CATEGORIES.map((c) => {
              const px = remToPx(vals[c.size] ?? SIZE_DEFAULT[c.size] ?? "1rem");
              return (
                <div key={c.key} className="flex flex-col gap-1.5 border-t border-cyan/15 pt-2.5 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-osd text-[12px] uppercase tracking-[0.15em] text-cyan">{c.label}</span>
                    <span className="font-mono text-[11px] text-fg-faint">{px}px</span>
                  </div>
                  <span className="font-mono text-[11px] leading-tight text-fg-faint">{c.desc}</span>
                  <select
                    value={firstFamily(vals[c.font] ?? "")}
                    onChange={(e) => update(c.font, fontStack(e.target.value))}
                    className="border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg"
                  >
                    {FONT_CHOICES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={0.5}
                    value={px}
                    onChange={(e) => update(c.size, pxToRem(parseFloat(e.target.value)))}
                    className="accent-cyan"
                  />
                  {c.key === "num2" && (
                    <button
                      type="button"
                      onClick={matchBody}
                      className="self-start font-osd text-[11px] uppercase tracking-[0.12em] text-purple hover:text-cyan"
                    >
                      = match Body 1
                    </button>
                  )}
                </div>
              );
            })}
          </Section>

          <Section title="Colours">
            {COLORS.map((t) => (
              <label key={t.v} className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-fg-dim">{t.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(vals[t.v] || "#000000").slice(0, 7)}
                    onChange={(e) => update(t.v, e.target.value)}
                    className="h-7 w-9 cursor-pointer border border-cyan/40 bg-transparent"
                  />
                  <input
                    type="text"
                    value={vals[t.v] ?? ""}
                    onChange={(e) => update(t.v, e.target.value)}
                    className="w-[88px] border border-cyan/50 bg-bg px-2 py-1 font-mono text-[12px] text-fg"
                  />
                </span>
              </label>
            ))}
          </Section>

          <Section title="Output">
            <textarea
              readOnly
              value={cssBlock}
              rows={14}
              className="w-full resize-y border border-cyan/40 bg-bg p-2 font-mono text-[12px] text-fg-dim"
            />
          </Section>
        </div>

        {/* ───────────────────────── Preview ───────────────────────── */}
        <div className="flex flex-col gap-6">
          <Panel label="Categories — each in action">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex flex-col gap-1 border-t border-cyan/15 pt-2 first:border-0 first:pt-0 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="w-40 shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-faint">
                  {c.label}
                </span>
                <span style={catStyle(c)} className="text-fg">
                  {SAMPLE[c.key]}
                </span>
              </div>
            ))}
          </Panel>

          <Panel label="In context — a project card">
            <div className="border border-cyan/30 bg-bg p-4">
              <div style={catStyle(cat("title"))} className="text-cyan text-glow-cyan">
                Ultramarines · 2nd Company
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span style={catStyle(cat("h2"))} className="uppercase tracking-[0.15em] text-fg-dim">
                  Status
                </span>
                <span
                  style={catStyle(cat("button"))}
                  className="inline-flex items-center border border-cyan px-2 py-0.5 uppercase tracking-[0.12em] text-cyan"
                >
                  Painting
                </span>
                <span
                  style={catStyle(cat("button"))}
                  className="inline-flex items-center border border-yellow px-2 py-0.5 uppercase tracking-[0.12em] text-yellow"
                >
                  Wishlist
                </span>
                <span
                  style={catStyle(cat("button"))}
                  className="inline-flex items-center border border-red px-2 py-0.5 uppercase tracking-[0.12em] text-red"
                >
                  High
                </span>
              </div>
              <p style={catStyle(cat("body"))} className="mt-3 text-fg-dim">
                Squad of 10 marines, mostly based. Notes: edge-highlight the armour with
                Fenrisian Grey, then glaze the recesses. No recipes attached yet.
              </p>
              <div className="mt-4 flex items-end gap-6">
                <div className="flex flex-col">
                  <span style={catStyle(cat("h2"))} className="uppercase tracking-[0.15em] text-fg-faint">
                    Complete
                  </span>
                  <span style={catStyle(cat("num1"))} className="leading-none text-green text-glow-green">
                    67%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span style={catStyle(cat("h2"))} className="uppercase tracking-[0.15em] text-fg-faint">
                    Models owned
                  </span>
                  <span style={catStyle(cat("num2"))} className="leading-none text-fg">
                    23
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span style={catStyle(cat("button"))} className="inline-flex items-center border border-purple bg-purple px-3 py-1 uppercase tracking-[0.12em] text-bg">
                  + Attach
                </span>
                <span style={catStyle(cat("button"))} className="inline-flex items-center border border-green bg-green px-3 py-1 uppercase tracking-[0.12em] text-bg">
                  + Slot
                </span>
                <span style={catStyle(cat("button"))} className="inline-flex items-center border border-cyan px-3 py-1 uppercase tracking-[0.12em] text-cyan">
                  Save
                </span>
              </div>
            </div>
          </Panel>

          <Panel label="In context — table + hero stats">
            <div className="flex flex-wrap gap-6">
              {([
                ["Active", "07", "text-cyan text-glow-cyan"],
                ["Done", "3%", "text-green text-glow-green"],
                ["Streak", "5d", "text-yellow text-glow-yellow"],
                ["Time", "0:00", "text-purple text-glow-purple"],
              ] as const).map(([label, value, cls]) => (
                <div key={label} className="flex flex-col">
                  <span style={catStyle(cat("h2"))} className="uppercase tracking-[0.15em] text-fg-faint">
                    {label}
                  </span>
                  <span style={catStyle(cat("num1"))} className={`leading-none ${cls}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="border-b border-cyan/20 text-left">
                  {["Name", "Brand", "Price"].map((h) => (
                    <th key={h} style={catStyle(cat("h2"))} className="px-3 py-1 uppercase tracking-[0.15em] text-fg-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ["Macragge Blue", "Citadel", "4.55"],
                  ["Mephiston Red", "Citadel", "4.55"],
                ] as const).map(([name, brand, price]) => (
                  <tr key={name} className="border-b border-fg/10">
                    <td style={catStyle(cat("body"))} className="px-3 py-1.5 text-fg">{name}</td>
                    <td style={catStyle(cat("body"))} className="px-3 py-1.5 text-fg-dim">{brand}</td>
                    <td style={catStyle(cat("num2"))} className="px-3 py-1.5 tabular-nums text-fg">${price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center gap-3">
              <span style={catStyle(cat("button"))} className="inline-flex items-center border border-dotted border-purple px-3 py-1 uppercase tracking-[0.1em] text-purple">
                + Attach ▾
              </span>
              <span style={catStyle(cat("body"))} className="text-fg-dim">
                ← trigger is Buttons; the open option list below is Body 1:
              </span>
            </div>
            <div className="w-48 border border-dotted border-cyan/40 bg-bg">
              {["Macragge Blue", "Mephiston Red", "Abaddon Black"].map((o) => (
                <div key={o} style={catStyle(cat("body"))} className="px-2 py-1 text-fg hover:bg-cyan/10">
                  {o}
                </div>
              ))}
            </div>
          </Panel>

          <Panel label="Palette">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {COLORS.map((t) => (
                <div key={t.v} className="flex flex-col items-center gap-1">
                  <div className="h-12 w-full border border-fg/20" style={{ background: `var(${t.v})` }} />
                  <span className="font-mono text-[12px] text-fg-faint">{t.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Representative sample text per category for the "each in action" panel. */
const SAMPLE: Record<string, React.ReactNode> = {
  title: "My Paint Collection",
  h1: "PROJECTS · COLLECTION · LIBRARY",
  h2: "NAME · BRAND · UPCOMING EVENTS · MODELS",
  body: "Plan your projects and track your paints across a 7,144-paint library.",
  button: "+ NEW PROJECT   SAVE   WISHLIST   HIGH",
  num1: "07  ·  3%  ·  12:34",
  num2: "14 15 16  ·  67%  ·  OWNED 23",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-cyan/30 bg-bg-raised/40 p-4">
      <h2 className="mb-3 font-osd text-[12px] uppercase tracking-[0.2em] text-cyan">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-cyan/40 bg-bg-raised/40 p-4">
      <div className="mb-3 font-osd text-[12px] uppercase tracking-[0.2em] text-fg-faint">{label}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
