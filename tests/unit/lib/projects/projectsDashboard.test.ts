/**
 * P12.6 — Projects dashboard table.
 *
 * The /projects page replaces its three-card section layout
 * (Backlog / Active / All projects) with one sortable table.
 * These tests pin the visible column set + sort behaviour +
 * default sort + the Ross-locked completion-bar thresholds.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("ProjectsDashboardTable component surface", () => {
  const src = read("src/components/ProjectsDashboardTable.tsx");

  test("renders a <table> (not the prior three-section card grid)", () => {
    expect(src).toContain("<table");
    expect(src).toContain("<thead");
    expect(src).toContain("<tbody");
  });

  test("locked column set: Name / Type / Recipes / Status / Priority / Completion", () => {
    expect(src).toContain('label="Name"');
    expect(src).toContain('label="Type"');
    expect(src).toContain("Recipes");
    expect(src).toContain('label="Status"');
    expect(src).toContain('label="Priority"');
    expect(src).toContain('label="Completion"');
  });

  test("default sort = updatedAt DESC", () => {
    expect(src).toContain('useState<SortKey>("updatedAt")');
    expect(src).toContain('useState<SortDir>("desc")');
  });

  test("Status pill mapping covers every DisplayStatus", () => {
    expect(src).toContain("WISHLIST:");
    expect(src).toContain("OWNED:");
    expect(src).toContain("BUILDING:");
    expect(src).toContain("PRIMING:");
    expect(src).toContain("PAINTING:");
    expect(src).toContain("BASING:");
    expect(src).toContain("COMPLETE:");
    expect(src).toContain("SHELVED:");
  });

  test("Name column links to /projects/<id>", () => {
    expect(src).toContain("`/projects?project=${encodeURIComponent(row.id)}`");
  });

  test("REDESIGN-CLEANUP fix 2 — project name renders white, not cyan", () => {
    // The Name link is --color-fg (white) so the cyan TYPE chip is the
    // differentiator; it stays a link (hover -> cyan + underline).
    expect(src).toContain(
      "text-[var(--color-fg)] hover:text-[var(--color-cyan)] hover:underline",
    );
  });

  test("FIGMA-REBUILD §3 — OWNED status renders neon green", () => {
    // The derived DisplayStatus key is OWNED and the column renders "OWNED"
    // in green.
    // FIGMA-REBUILD §3 — the Dashboard.png reference shows STATUS as a green
    // mono text label (not a tone-keyed pill), so the green comes from
    // STATUS_TEXT_CLASS.
    expect(src).toContain('OWNED: "text-[var(--color-green)]"');
    expect(src).toContain('OWNED: "OWNED"');
    // The visible label flows through STATUS_LABEL, never the raw status key,
    // on both the desktop pill and the mobile comparison row.
    expect(src).toContain("STATUS_LABEL[row.status]");
    expect(src).toContain("{STATUS_LABEL[s]}");
  });

  test("Type column uses the existing per-type chip palette", () => {
    expect(src).toContain("type-chip");
    expect(src).toContain("type-chip-cyan");
  });

  test("Completion column uses the solid ProgressBar (DASHBOARD-REDESIGN)", () => {
    // Part B item 2 — Ross's mockup wants a SOLID gold-standard progress bar
    // for completion, not the segmented blocks. The cell renders a stretched
    // <ProgressBar> + a tabular-nums readout chip.
    expect(src).toContain("<ProgressBar");
    expect(src).not.toContain("<SegmentedBar");
    expect(src).toContain("row.progressPercent");
  });

  test("focused project row gets the persistent cyan active line (UX-006)", () => {
    // Keyed to the pinned Focus project id threaded from the page.
    expect(src).toContain("focusProjectId");
    expect(src).toContain("isFocus");
    expect(src).toContain('data-focus-row');
  });

  test("settled (complete/shelved) rows dim for hierarchy (UX-006)", () => {
    expect(src).toContain("isSettledStatus");
    expect(src).toMatch(/dimmed/);
  });

  test("STATUS_RANK orders WISHLIST first, SHELVED last", () => {
    // The status-column sort uses this ordering; pin it so a future
    // refactor can't drag the lead-stage semantic backwards.
    expect(src).toMatch(/WISHLIST:\s*0/);
    expect(src).toMatch(/SHELVED:\s*7/);
  });

  test("PRIORITY_RANK orders Urgent first", () => {
    expect(src).toMatch(/Urgent:\s*0/);
    expect(src).toMatch(/Low:\s*3/);
  });
});

describe("ProgressBar — Ross's locked threshold set", () => {
  const src = read("src/components/ProgressBar.tsx");

  test("auto tone thresholds: red < 25 / yellow 25-75 / green >= 75", () => {
    expect(src).toContain("clamped >= 75");
    expect(src).toContain("clamped >= 25");
    expect(src).toContain('"danger"');
    expect(src).toContain('"warning"');
    expect(src).toContain('"ok"');
  });
});

describe("displayStatus — Phase-12 vocabulary", () => {
  const src = read("src/lib/progress.ts");

  test("the DisplayStatus type union carries Ross's 8 locked stages", () => {
    expect(src).toMatch(/"WISHLIST"/);
    expect(src).toMatch(/"OWNED"/);
    expect(src).toMatch(/"BUILDING"/);
    expect(src).toMatch(/"PRIMING"/);
    expect(src).toMatch(/"PAINTING"/);
    expect(src).toMatch(/"BASING"/);
    expect(src).toMatch(/"COMPLETE"/);
    expect(src).toMatch(/"SHELVED"/);
  });

  test("legacy strings ('New', 'Pile', 'Assembling', 'Completed') are gone", () => {
    expect(src).not.toMatch(/return "New"/);
    expect(src).not.toMatch(/return "Pile"/);
    expect(src).not.toMatch(/return "Assembling"/);
    expect(src).not.toMatch(/return "Completed"/);
    expect(src).not.toMatch(/return "Shelved"/);
  });
});

describe("Projects page wires the dashboard table in", () => {
  const src = read("src/app/projects/page.tsx");

  test("imports ProjectsDashboardTable + getProjectPalettesMap", () => {
    expect(src).toContain("ProjectsDashboardTable");
    expect(src).toContain("getProjectPalettesMap");
  });

  test("the old Backlog / Active card sections are gone", () => {
    expect(src).not.toContain('title="Backlog"');
    expect(src).not.toContain('title="Active"');
    expect(src).not.toContain('title="All projects"');
    // The Backlog Card listing is removed.
    expect(src).not.toContain("listBacklogUnits");
    expect(src).not.toContain("listActiveProjects");
  });

  test("ADD PROJECT / UPLOAD ARMY LIST CTAs sit under the table; no quick-add bar", () => {
    // FIGMA-REBUILD §3 — the Dashboard.png reference moves the CTAs UNDER
    // the PROJECTS table (rendered by DashboardProjectsTable): ADD PROJECT
    // is the primary (cyan) solid, UPLOAD ARMY LIST the tertiary outline.
    // The redundant quick-add / search bar is gone from the dashboard.
    const table = read("src/components/projects/DashboardProjectsTable.tsx");
    expect(table).toContain('variant="primary"');
    expect(table).toContain("Add project");
    expect(table).toContain("Upload army list");
    // The quick-add search bar is gone from the dashboard page header.
    expect(src).not.toContain("<QuickAddBar");
  });

  test("header uses shared PageHeader with green DASHBOARD accent", () => {
    expect(src).toContain("<PageHeader");
    expect(src).toContain('accent="green"');
    expect(src).toContain('title="DASHBOARD"');
  });
});
