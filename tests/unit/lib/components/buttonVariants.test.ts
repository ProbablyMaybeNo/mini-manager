import { describe, expect, test } from "vitest";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/Button";

/* Button primitive — P12.23 variant semantics.
 *
 * The four-colour palette Ross locked for Phase 12:
 *   success  -> .btn-success  (neon green, ADD/CREATE/NEW)
 *   warning  -> .btn-warning  (pastel yellow, SHARE/IMPORT/EXPORT/ADD-TO-WISH)
 *   purple   -> .btn-purple   (pastel purple, SPECIAL/FEATURED/FOUNDER)
 *
 * These need their CSS classes wired so the P12.24 sweep can flip every
 * call site to the correct variant in one mechanical pass. */

function render(props: Parameters<typeof Button>[0]): ReactElement {
  return Button(props) as unknown as ReactElement;
}

function classNameOf(el: ReactElement): string {
  const props = (el as unknown as { props: Record<string, unknown> }).props;
  return String(props.className ?? "");
}

describe("Button primitive — Phase 12 variant classes", () => {
  test("variant='success' renders .btn-success", () => {
    const el = render({ variant: "success", children: "Add unit" });
    expect(classNameOf(el)).toMatch(/\bbtn-success\b/);
  });

  test("variant='warning' renders .btn-warning", () => {
    const el = render({ variant: "warning", children: "Share" });
    expect(classNameOf(el)).toMatch(/\bbtn-warning\b/);
  });

  test("variant='purple' renders .btn-purple", () => {
    const el = render({ variant: "purple", children: "Founder" });
    expect(classNameOf(el)).toMatch(/\bbtn-purple\b/);
  });

  test("existing variants stay wired", () => {
    expect(classNameOf(render({ variant: "primary", children: "X" }))).toMatch(
      /\bbtn-primary\b/,
    );
    expect(
      classNameOf(render({ variant: "secondary", children: "X" })),
    ).toMatch(/\bbtn-secondary\b/);
    expect(classNameOf(render({ variant: "ghost", children: "X" }))).toMatch(
      /\bbtn-ghost\b/,
    );
    expect(classNameOf(render({ variant: "danger", children: "X" }))).toMatch(
      /\bbtn-danger\b/,
    );
  });

  test("anchor form (as='a') also picks up the new variants", () => {
    const el = render({
      as: "a",
      href: "/x",
      variant: "success",
      children: "Add",
    });
    expect(classNameOf(el)).toMatch(/\bbtn-success\b/);
    expect((el as unknown as { type: string }).type).toBe("a");
  });

  test("default size is md regardless of variant", () => {
    expect(classNameOf(render({ variant: "success", children: "X" }))).toMatch(
      /\bbtn-md\b/,
    );
    expect(classNameOf(render({ variant: "warning", children: "X" }))).toMatch(
      /\bbtn-md\b/,
    );
    expect(classNameOf(render({ variant: "purple", children: "X" }))).toMatch(
      /\bbtn-md\b/,
    );
  });
});

describe("Button primitive — globals.css must define the new btn-* classes", () => {
  /* Sanity check that we updated globals.css. The classes have to be
   * present as `.btn-success` / `.btn-warning` / `.btn-purple` selectors
   * or the markup renders unstyled, which would silently break the
   * P12.24 sweep when ADD-MODEL buttons appear cyan-bordered or worse,
   * invisible (UX-V6-002 was exactly this failure mode). */
  test("globals.css declares the three new button classes", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const css = await fs.readFile(
      path.resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(css).toMatch(/\.btn-success\s*\{/);
    expect(css).toMatch(/\.btn-warning\s*\{/);
    expect(css).toMatch(/\.btn-purple\s*\{/);
  });

  test("success + warning use solid backgrounds with dark text (Ross's locked rule)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const css = await fs.readFile(
      path.resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    // Slice each class definition body, check rules
    const successMatch = css.match(/\.btn-success\s*\{([^}]*)\}/);
    const warningMatch = css.match(/\.btn-warning\s*\{([^}]*)\}/);
    expect(successMatch).not.toBeNull();
    expect(warningMatch).not.toBeNull();
    expect(successMatch?.[1]).toMatch(/background:\s*var\(--color-green\)/);
    expect(successMatch?.[1]).toMatch(/color:\s*var\(--color-bg\)/);
    expect(warningMatch?.[1]).toMatch(/background:\s*var\(--color-yellow\)/);
    expect(warningMatch?.[1]).toMatch(/color:\s*var\(--color-bg\)/);
  });
});
