"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, type ButtonProps } from "@/components/kit";
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

const FONTS: Tok[] = [
  { v: "--font-display", label: "Display · titles" },
  { v: "--font-osd", label: "OSD · headers / menu" },
  { v: "--font-mono", label: "Body · tables / text" },
  { v: "--font-button", label: "Buttons" },
  { v: "--font-body2", label: "Activity / log" },
  { v: "--font-lightpixel", label: "font-lightpixel" },
  { v: "--font-unbutton", label: "font-unbutton" },
];

/** The faces currently loaded in the app (globals.css @font-face / @fontsource). */
const FONT_CHOICES = [
  "3D Pixel",
  "Unbutton",
  "Light Pixel 7",
  "DePixel Klein",
  "DePixel Breit",
  "Pixeland",
  "IBM BIOS",
  "Apricot 256L",
  "IBM XGA-AI",
  "VT323",
  "UAV OSD Mono",
  "Share Tech Mono",
  "Flexi IBM VGA True",
  "IBM Plex Mono",
  "Courier New",
  "monospace",
];

const SIZES: { v: string; label: string; min: number; max: number }[] = [
  { v: "--text-xs", label: "text-xs · body / tables", min: 8, max: 22 },
  { v: "--text-sm", label: "text-sm · emphasis", min: 8, max: 26 },
  { v: "--text-base", label: "text-base", min: 10, max: 30 },
  { v: "--text-lg", label: "text-lg · subheads", min: 12, max: 36 },
  { v: "--text-xl", label: "text-xl · subtitles", min: 14, max: 44 },
  { v: "--text-2xl", label: "text-2xl · titles", min: 16, max: 60 },
  { v: "--text-3xl", label: "text-3xl · big titles", min: 18, max: 80 },
  { v: "--text-4xl", label: "text-4xl · stat numbers", min: 20, max: 100 },
  // Role-specific sizes (independent of the body scale).
  { v: "--text-button", label: "Buttons", min: 8, max: 28 },
  { v: "--text-dropdown", label: "Dropdown menus", min: 8, max: 28 },
  { v: "--text-element", label: "Tools / activity (feature)", min: 8, max: 28 },
];

/** Sane fallbacks so the sliders seed correctly even if a token isn't emitted. */
const SIZE_DEFAULT: Record<string, string> = {
  "--text-xs": "0.8125rem",
  "--text-sm": "0.9375rem",
  "--text-base": "1rem",
  "--text-lg": "1.125rem",
  "--text-xl": "1.25rem",
  "--text-2xl": "1.5rem",
  "--text-3xl": "1.875rem",
  "--text-4xl": "2.25rem",
  "--text-button": "0.75rem",
  "--text-dropdown": "0.8125rem",
  "--text-element": "0.75rem",
};

// The full canonical button set — every variant the app has. Anything that
// looks like a button anywhere (chips, type indicators, dropdown triggers)
// should use one of these, not bespoke styling.
const BTN_VARIANTS: NonNullable<ButtonProps["variant"]>[] = [
  "primary",
  "secondary",
  "tertiary",
  "danger",
  "add",
  "addWishlist",
  "solidCyan",
  "solidGreen",
  "solidYellow",
  "solidPurple",
  "solidRed",
  "outlineCyan",
  "outlineGreen",
  "outlineYellow",
  "outlinePurple",
  "outlineRed",
];

const ALL_VARS = [...COLORS, ...FONTS, ...SIZES].map((t) => t.v);

const read = (v: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const set = (v: string, value: string) =>
  document.documentElement.style.setProperty(v, value);

const firstFamily = (stack: string) =>
  (stack.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");

const fontStack = (family: string) =>
  family === "monospace"
    ? "monospace"
    : `"${family}", "IBM Plex Mono", monospace`;

const remToPx = (rem: string) => Math.round((parseFloat(rem) || 0) * 16);
const pxToRem = (px: number) => `${(px / 16).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}rem`;

export function ThemeStudio() {
  // varName -> current value (colour hex, font stack, or size rem)
  const [vals, setVals] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Apply any saved overrides to this page, then seed the controls from the
  // live computed styles (which now reflect those overrides).
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
      "  /* type families */",
      ...FONTS.map((t) => line(t.v)),
      "",
      "  /* text sizes */",
      ...SIZES.map((t) => line(t.v)),
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

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-cyan/40 px-6 py-3">
        <div>
          <h1 className="font-display text-2xl text-cyan text-glow-cyan">Theme Studio</h1>
          <p className="font-mono text-xs text-fg-dim">
            Dev-only · edit tokens live, then copy the @theme block into src/app/globals.css
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

      <div className="grid gap-6 p-6 lg:grid-cols-[360px_1fr]">
        {/* ───────────────────────── Controls ───────────────────────── */}
        <div className="flex flex-col gap-6">
          <Section title="Fonts">
            {FONTS.map((t) => (
              <label key={t.v} className="flex items-center justify-between gap-3">
                <span className="font-osd text-[12px] uppercase tracking-[0.15em] text-fg-dim">
                  {t.label}
                </span>
                <select
                  value={firstFamily(vals[t.v] ?? "")}
                  onChange={(e) => update(t.v, fontStack(e.target.value))}
                  className="min-w-[150px] border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg"
                >
                  {FONT_CHOICES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            ))}
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

          <Section title="Sizes">
            {SIZES.map((t) => {
              const px = remToPx(vals[t.v] ?? "0.75rem");
              return (
                <label key={t.v} className="flex flex-col gap-1">
                  <span className="flex justify-between font-mono text-xs text-fg-dim">
                    <span>{t.label}</span>
                    <span className="text-cyan">{px}px</span>
                  </span>
                  <input
                    type="range"
                    min={t.min}
                    max={t.max}
                    step={0.5}
                    value={px}
                    onChange={(e) => update(t.v, pxToRem(parseFloat(e.target.value)))}
                    className="accent-cyan"
                  />
                </label>
              );
            })}
          </Section>

          <Section title="Output">
            <textarea
              readOnly
              value={cssBlock}
              rows={12}
              className="w-full resize-y border border-cyan/40 bg-bg p-2 font-mono text-[12px] text-fg-dim"
            />
          </Section>
        </div>

        {/* ───────────────────────── Preview ───────────────────────── */}
        <div className="flex flex-col gap-6">
          <Panel label="Type scale">
            <h1 className="font-display text-4xl text-cyan text-glow-cyan">Mini-Manager</h1>
            {FONTS.map((t) => (
              <div key={t.v} className="border-t border-cyan/15 pt-2">
                <div className="font-mono text-[12px] text-fg-faint">{t.label}</div>
                <div style={{ fontFamily: `var(${t.v})` }} className="text-xl text-fg">
                  AaBbCc 0123 — The quick brown fox
                </div>
              </div>
            ))}
            <p className="font-mono text-sm text-fg-dim">
              Body copy (font-mono / text-sm): plan your projects, track your paints, manage
              your minis across a 7,144-paint cross-brand library.
            </p>
          </Panel>

          <Panel label="Size scale">
            {[
              ["text-xs", "body / tables"],
              ["text-sm", "emphasis"],
              ["text-base", "base"],
              ["text-lg", "subheads"],
              ["text-xl", "subtitles"],
              ["text-2xl", "titles"],
              ["text-3xl", "big titles"],
            ].map(([cls, role]) => (
              <div key={cls} className="flex items-baseline gap-3 border-t border-cyan/15 pt-1">
                <span className="w-24 shrink-0 font-mono text-[12px] text-fg-faint">{cls}</span>
                <span className={`${cls} text-fg`}>{role} — Mini-Manager 0123</span>
              </div>
            ))}
          </Panel>

          <Panel label="Palette">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {COLORS.map((t) => (
                <div key={t.v} className="flex flex-col items-center gap-1">
                  <div
                    className="h-12 w-full border border-fg/20"
                    style={{ background: `var(${t.v})` }}
                  />
                  <span className="font-mono text-[12px] text-fg-faint">{t.label}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel label="Buttons">
            <div className="flex flex-wrap gap-2">
              {BTN_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size="sm">
                  {variant}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel label="Controls + table">
            <div className="flex flex-wrap items-center gap-3">
              <input
                placeholder="Sample input"
                className="border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg placeholder:text-fg-faint"
              />
              {/* The attach affordance + the row status indicators are real
                  Button variants now (outlinePurple / outlineGreen / …), not
                  hand-rolled chips — so every "button-shaped" thing here maps
                  back to the Buttons section above. */}
              <Button variant="outlinePurple" size="sm">
                + attach
              </Button>
            </div>
            <table className="mt-2 w-full border-collapse font-mono text-xs">
              <tbody>
                {(
                  [
                    ["Macragge Blue", "Citadel", "$4.55", "outlineGreen"],
                    ["Mephiston Red", "Citadel", "$4.55", "outlineYellow"],
                  ] as const
                ).map(([name, brand, price, variant]) => (
                  <tr key={name} className="border-b border-fg/10">
                    <td className="px-3 py-2 text-fg">{name}</td>
                    <td className="px-3 py-2 text-fg-dim">{brand}</td>
                    <td className="px-3 py-2 tabular-nums text-fg">{price}</td>
                    <td className="px-3 py-2">
                      <Button variant={variant} size="sm">
                        owned
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </div>
  );
}

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
      <div className="mb-3 font-osd text-[12px] uppercase tracking-[0.2em] text-fg-faint">
        {label}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
