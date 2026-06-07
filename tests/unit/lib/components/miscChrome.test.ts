/**
 * GOLD-STANDARD §12 — Misc chrome: notification badge, breadcrumb,
 * terminal prompt. Pins the SSR'd markup + the §12 CSS contract.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationBadge } from "@/components/ui/NotificationBadge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { TerminalPrompt } from "@/components/ui/TerminalPrompt";

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

describe("§12 — NotificationBadge", () => {
  test("renders a red-outline count chip", () => {
    const out = renderToStaticMarkup(
      createElement(NotificationBadge, { count: 3 }),
    );
    expect(out).toMatch(/class="notif-badge"/);
    expect(out).toContain(">3<");
    expect(out).toMatch(/aria-label="3 unread"/);
  });

  test("count <= 0 renders nothing (no empty badge)", () => {
    expect(
      renderToStaticMarkup(createElement(NotificationBadge, { count: 0 })),
    ).toBe("");
    expect(
      renderToStaticMarkup(createElement(NotificationBadge, { count: -5 })),
    ).toBe("");
  });

  test("clamps over max to NN+", () => {
    const out = renderToStaticMarkup(
      createElement(NotificationBadge, { count: 250, max: 99 }),
    );
    expect(out).toContain("99+");
    expect(out).toMatch(/aria-label="250 unread"/);
  });

  test(".notif-badge is a red border + red text box", () => {
    const body = ruleBody(".notif-badge");
    expect(body).toMatch(/color:\s*var\(--color-red\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--color-red\)/);
  });
});

describe("§12 — Breadcrumb", () => {
  const items = [
    { label: "ROOT", href: "/" },
    { label: "SYSTEM", href: "/system" },
    { label: "DASHBOARD" },
  ];
  const out = renderToStaticMarkup(createElement(Breadcrumb, { items }));

  test("renders a nav with the slash-separated trail", () => {
    expect(out).toMatch(/<nav[^>]*aria-label="Breadcrumb"/);
    expect(out).toContain("ROOT");
    expect(out).toContain("SYSTEM");
    expect(out).toContain("DASHBOARD");
    expect(out).toContain("/");
  });

  test("non-final crumbs with href are links; last is the current page", () => {
    expect(out).toMatch(/class="breadcrumb-link"[^>]*href="\//);
    expect(out).toMatch(/class="breadcrumb-current"[^>]*aria-current="page"/);
  });

  test("custom separator is honoured", () => {
    const piped = renderToStaticMarkup(
      createElement(Breadcrumb, { items, separator: ">" }),
    );
    expect(piped).toContain(">");
  });

  test(".breadcrumb-link is cyan; .breadcrumb-current is white", () => {
    expect(ruleBody(".breadcrumb-link")).toMatch(/color:\s*var\(--color-cyan\)/);
    expect(ruleBody(".breadcrumb-current")).toMatch(/color:\s*var\(--color-fg\)/);
  });
});

describe("§12 — TerminalPrompt", () => {
  test("defaults to root@terminal:~# with a blinking cursor", () => {
    const out = renderToStaticMarkup(createElement(TerminalPrompt, {}));
    expect(out).toContain("root@terminal:~#");
    expect(out).toMatch(/class="terminal-prompt-cursor"/);
    expect(out).toMatch(/aria-hidden/);
  });

  test("renders an optional typed command", () => {
    const out = renderToStaticMarkup(
      createElement(TerminalPrompt, { command: "ls -la" }),
    );
    expect(out).toContain("ls -la");
    expect(out).toMatch(/class="terminal-prompt-cmd"/);
  });

  test("cursor can be disabled", () => {
    const out = renderToStaticMarkup(
      createElement(TerminalPrompt, { cursor: false }),
    );
    expect(out).not.toMatch(/terminal-prompt-cursor/);
  });

  test(".terminal-prompt-ps1 is green; cursor blink stripped under reduced-motion", () => {
    expect(ruleBody(".terminal-prompt-ps1")).toMatch(
      /color:\s*var\(--color-green\)/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.terminal-prompt-cursor\s*\{\s*animation:\s*none/,
    );
  });
});
