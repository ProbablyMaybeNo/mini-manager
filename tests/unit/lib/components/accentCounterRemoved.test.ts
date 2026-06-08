/**
 * R7-013 — decorative "02" / "01" / "03" / "04" giant numerals removed.
 *
 * The auditor flagged the AccentCounter component (a giant 96px,
 * faded-cyan, decorative numeral in the page header corners) at
 * ~1.06:1 contrast and zero semantic meaning. The brief locks "drop
 * or shrink to chrome scale" — drop is the cleaner read: aria-hidden
 * decoration that contributes nothing to comprehension, costs hero
 * real estate at desktop sizes, and adds another visual axis the
 * scanner has to parse past on first load.
 *
 * The component file and every callsite are gone. This sentinel
 * pins the deletion so a future refactor can't quietly resurrect it.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel));
}

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("R7-013 — AccentCounter dropped", () => {
  test("the component file is gone", () => {
    expect(exists("src/components/ui/AccentCounter.tsx")).toBe(false);
  });

  test("library page header no longer mounts AccentCounter", () => {
    const src = read("src/app/library/page.tsx");
    expect(src).not.toContain("AccentCounter");
    expect(src).not.toContain('value="02"');
  });

  test("projects empty state no longer mounts AccentCounter", () => {
    const src = read("src/app/projects/page.tsx");
    expect(src).not.toContain("AccentCounter");
    expect(src).not.toContain('value="01"');
  });

  test("recipes empty state no longer mounts AccentCounter", () => {
    const src = read("src/app/recipes/page.tsx");
    expect(src).not.toContain("AccentCounter");
    expect(src).not.toContain('value="03"');
  });

  test("collections empty state no longer mounts AccentCounter", () => {
    const src = read("src/app/collections/page.tsx");
    expect(src).not.toContain("AccentCounter");
    expect(src).not.toContain('value="04"');
  });

  test("no remaining imports from @/components/ui/AccentCounter anywhere", () => {
    // Final sweep — scan a small set of likely directories. If a new
    // page slipped one in, this test fails before the audit catches it.
    const targets = [
      "src/app",
      "src/components",
    ];
    for (const dir of targets) {
      walkDir(path.resolve(ROOT, dir)).forEach((file) => {
        if (!file.endsWith(".tsx") && !file.endsWith(".ts")) return;
        const txt = fs.readFileSync(file, "utf-8");
        if (txt.includes("AccentCounter")) {
          throw new Error(`AccentCounter resurrected in ${file}`);
        }
      });
    }
  });
});

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkDir(full));
    else out.push(full);
  }
  return out;
}
