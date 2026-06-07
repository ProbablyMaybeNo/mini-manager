import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ReactElement } from "react";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

function collectClasses(node: unknown, out: string[]) {
  if (node == null || typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const c of node) collectClasses(c, out);
    return;
  }
  const n = node as { props?: Record<string, unknown> };
  if (typeof n !== "object") return;
  const cls = n.props?.className;
  if (typeof cls === "string") out.push(cls);
  if (n.props?.children != null) collectClasses(n.props.children, out);
}

function classesOf(el: ReactElement): string {
  const out: string[] = [];
  collectClasses(el, out);
  return out.join(" ");
}

/**
 * StatusPill kind contract — locks the 7-active + 1-deprecated surface
 * area added in P11.10. `purple` is the canonical 5th-palette slot;
 * `magenta` remains as a deprecated alias so existing markup keeps
 * rendering during the Phase 11 sweep but new code should use `purple`.
 */
const ACTIVE_KINDS: StatusPillKind[] = [
  "ok",
  "warning",
  "wishlist",
  "danger",
  "info",
  "neutral",
  "purple",
];

describe("StatusPill kinds", () => {
  test("purple is exposed as the 5th-palette accent (P11.10)", () => {
    const kind: StatusPillKind = "purple";
    expect(kind).toBe("purple");
  });

  test("magenta is still accepted as a deprecated alias (back-compat)", () => {
    const kind: StatusPillKind = "magenta";
    expect(kind).toBe("magenta");
  });

  test("all seven canonical kinds compile against the type", () => {
    // Compile-time check — if any kind drops out of the union this fails
    // at typecheck before reaching the assertion.
    for (const k of ACTIVE_KINDS) {
      expect(k).toBeTruthy();
    }
  });
});

describe("GOLD-STANDARD §05 — outline pill is a lit phosphor badge", () => {
  /** All `selector { body }` blocks for a selector (the reduced-motion
   *  media query restates some, so collect every match). */
  function ruleBodies(selector: string): string[] {
    const re = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
      "g",
    );
    const out: string[] = [];
    let m;
    while ((m = re.exec(css)) !== null) {
      if (m[1] !== undefined) out.push(m[1]);
    }
    return out;
  }
  function ruleBody(selector: string): string {
    return ruleBodies(selector)[0] ?? "";
  }

  test(".pill carries a 1px currentColor border + in-hue edge glow", () => {
    const body = ruleBody(".pill");
    expect(body).toMatch(/border:\s*1px solid currentColor/);
    expect(body).toMatch(/box-shadow:\s*var\(--glow-edge\)/);
  });

  test(".pill-dot is a self-coloured disc with its own halo", () => {
    // The reduced-motion block restates `.pill-dot { box-shadow: none }`;
    // pick the rule that actually styles the disc (has a background).
    const body =
      ruleBodies(".pill-dot").find((b) => /background:/.test(b)) ?? "";
    expect(body).toMatch(/background:\s*currentColor/);
    expect(body).toMatch(/border-radius:\s*50%/);
    expect(body).toMatch(/box-shadow:\s*0 0 6px -1px currentColor/);
  });

  for (const kind of ACTIVE_KINDS) {
    test(`.pill-dot-${kind} sets the dot colour token`, () => {
      expect(css).toMatch(new RegExp(`\\.pill-dot-${kind}\\s*\\{[^}]*color:`));
    });
  }
});

describe("GOLD-STANDARD §05 — StatusPill dot prop (ONLINE/OFFLINE/BUSY)", () => {
  test("no dot by default", () => {
    const el = StatusPill({ status: "ok", children: "RUN" }) as ReactElement;
    expect(classesOf(el)).not.toMatch(/\bpill-dot\b/);
  });

  test("dot={true} colours the dot the same as the pill", () => {
    const el = StatusPill({
      status: "ok",
      dot: true,
      children: "ONLINE",
    }) as ReactElement;
    expect(classesOf(el)).toMatch(/\bpill-dot\b/);
    expect(classesOf(el)).toMatch(/\bpill-dot-ok\b/);
  });

  test("dot={kind} overrides the dot colour independently of the pill", () => {
    // Image §05: neutral white pill + coloured dot (green online / cyan busy).
    const online = StatusPill({
      status: "neutral",
      dot: "ok",
      children: "ONLINE",
    }) as ReactElement;
    expect(classesOf(online)).toMatch(/\bpill-neutral\b/);
    expect(classesOf(online)).toMatch(/\bpill-dot-ok\b/);

    const busy = StatusPill({
      status: "neutral",
      dot: "info",
      children: "BUSY",
    }) as ReactElement;
    expect(classesOf(busy)).toMatch(/\bpill-dot-info\b/);
  });

  test("dot is ignored on tone='bar'", () => {
    const el = StatusPill({
      status: "ok",
      tone: "bar",
      dot: true,
      children: "DONE",
    }) as ReactElement;
    expect(classesOf(el)).not.toMatch(/\bpill-dot\b/);
  });
});
