/**
 * GOLD-STANDARD §04 — Inputs & selects.
 *
 * White-border text / password / select / textarea with the label ABOVE
 * the control, dim placeholder, cyan chevron on the select, and a
 * cyan-checked checkbox + radio. Pins the §04 CSS contract + the Field
 * primitive markup (label-stack, white-border control, native controls
 * that inherit the global cyan accent).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TextField,
  SelectField,
  TextAreaField,
  CheckField,
  RadioField,
} from "@/components/ui/Field";

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

/** SSR the component to an HTML string — gives `useId` a valid render
 *  context and lets us assert on the real rendered markup. */
function html(component: unknown, props: Record<string, unknown>): string {
  return renderToStaticMarkup(
    createElement(component as React.FC, props as never),
  );
}

describe("§04 — CSS contract", () => {
  test("checkbox + radio use the cyan accent (checked = cyan)", () => {
    expect(css).toMatch(
      /input\[type="checkbox"\],\s*\n\s*input\[type="radio"\]\s*\{[^}]*accent-color:\s*var\(--color-cyan\)/,
    );
  });

  test(".field-control is a white-border, near-black box", () => {
    const body = ruleBody(".field-control");
    expect(body).toMatch(/border:\s*1px solid var\(--color-border-input\)/);
    expect(body).toMatch(/background:\s*var\(--color-bg-elevated\)/);
  });

  test(".field-control placeholder is dim (the disabled token)", () => {
    expect(ruleBody(".field-control::placeholder")).toMatch(
      /color:\s*var\(--color-disabled\)/,
    );
  });

  test(".field-label is a small-caps mono caption above the control", () => {
    const body = ruleBody(".field-label");
    expect(body).toMatch(/text-transform:\s*uppercase/);
    expect(body).toMatch(/font-family:\s*var\(--font-mono\)/);
  });

  test("select drops the native arrow and draws a cyan chevron SVG", () => {
    const body = ruleBody("select.field-control");
    expect(body).toMatch(/appearance:\s*none/);
    expect(body).toMatch(/background-image:\s*url\(/);
    // The chevron stroke is the cyan token hex (%237DF9FF = #7DF9FF).
    expect(body).toMatch(/%237DF9FF/i);
  });

  test("--color-border-input is white (the §04 white field border)", () => {
    expect(css).toMatch(/--color-border-input:\s*#ffffff/i);
  });
});

describe("§04 — Field primitives render label above a white-border control", () => {
  test("TextField: a .field-label <label> precedes the .field-control input", () => {
    const out = html(TextField, {
      label: "TEXT INPUT",
      placeholder: "Enter value…",
    });
    expect(out).toMatch(/<label[^>]*class="field-label"[^>]*for="([^"]+)"/);
    expect(out).toMatch(/<input[^>]*class="field-control[^"]*"/);
    // The label's `for` targets the input's id (clickable caption).
    const forId = out.match(/<label[^>]*for="([^"]+)"/)?.[1];
    expect(forId).toBeTruthy();
    expect(out).toContain(`id="${forId}"`);
    // Label markup appears before the input markup (label ABOVE control).
    expect(out.indexOf("field-label")).toBeLessThan(out.indexOf("field-control"));
  });

  test("SelectField renders a <select.field-control>", () => {
    const out = html(SelectField, { label: "SELECT BOX", children: null });
    expect(out).toMatch(/<select[^>]*class="field-control[^"]*"/);
  });

  test("TextAreaField renders a <textarea.field-control>", () => {
    const out = html(TextAreaField, { label: "TEXT AREA" });
    expect(out).toMatch(/<textarea[^>]*class="field-control"/);
  });

  test("CheckField wraps a native checkbox in a .field-toggle row", () => {
    const out = html(CheckField, { label: "CHECKED" });
    expect(out).toMatch(/class="field-toggle[^"]*"/);
    expect(out).toMatch(/<input[^>]*type="checkbox"/);
  });

  test("RadioField wraps a native radio in a .field-toggle row", () => {
    const out = html(RadioField, { label: "SELECTED", name: "g" });
    expect(out).toMatch(/class="field-toggle[^"]*"/);
    expect(out).toMatch(/<input[^>]*type="radio"/);
  });
});
