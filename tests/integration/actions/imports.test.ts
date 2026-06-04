import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { and, eq, isNotNull } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { imports, projects } from "@/db/schema";
import type { ImportedTree } from "@/lib/imports/types";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));
vi.mock("@/lib/auth-stub", () => ({
  currentUserId: async () => state.userId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { getImport, listImports } = await import("@/db/queries/imports");
const {
  applyImport,
  createFileImport,
  createTextImport,
  fetchImportForPreview,
} = await import("@/lib/actions/imports");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("imports schema — round-trip", () => {
  test("import row persists parsedTree JSON and reads back via getImport", async () => {
    const tree: ImportedTree = {
      armyName: "Test Army",
      totalPoints: 2000,
      faction: "Adeptus Astartes",
      units: [
        { name: "Intercessors", count: 10, points: 200 },
        { name: "Tactical Squad", count: 10, points: 135 },
      ],
    };

    const [row] = await state.db!
      .insert(imports)
      .values({
        ownerId: state.userId,
        sourceFormat: "plain-text",
        sourceTextPreview: "10x Intercessors\n10x Tactical Squad\n",
        sourceFileSize: 48,
        status: "parsed",
        parsedTree: JSON.stringify(tree),
        parserConfidence: 0.85,
        parserUsed: "text",
      })
      .returning();

    const fetched = await getImport(state.userId, row!.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.sourceFormat).toBe("plain-text");
    expect(fetched!.status).toBe("parsed");
    expect(fetched!.parserConfidence).toBeCloseTo(0.85, 3);
    expect(fetched!.parserUsed).toBe("text");

    const parsed = JSON.parse(fetched!.parsedTree!) as ImportedTree;
    expect(parsed.armyName).toBe("Test Army");
    expect(parsed.units).toHaveLength(2);
    expect(parsed.units[0]!.name).toBe("Intercessors");
    expect(parsed.units[0]!.count).toBe(10);
  });

  test("getImport returns null when the row belongs to another user", async () => {
    const [row] = await state.db!
      .insert(imports)
      .values({
        ownerId: state.userId,
        sourceFormat: "battlescribe-ros",
        status: "pending",
      })
      .returning();
    const other = await getImport("not-the-owner", row!.id);
    expect(other).toBeNull();
  });

  test("createTextImport persists the parsed tree + parser metadata", async () => {
    const list = `## Ultramarines Strike Force
Faction: Adeptus Astartes
Points Limit: 2000

10x Intercessors - 200pts
5x Terminators - 185pts
Captain - 105pts
`;
    const res = await createTextImport({ rawText: list });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await getImport(state.userId, res.data.importId);
    expect(row).not.toBeNull();
    expect(row!.sourceFormat).toBe("plain-text");
    expect(row!.status).toBe("parsed");
    expect(row!.parserUsed).toBe("text");
    expect(row!.sourceTextPreview).toContain("Ultramarines");

    const tree = JSON.parse(row!.parsedTree!) as ImportedTree;
    expect(tree.armyName).toBe("Ultramarines Strike Force");
    expect(tree.faction).toBe("Adeptus Astartes");
    expect(tree.units.length).toBeGreaterThanOrEqual(3);
  });

  test("createFileImport parses a .json list via the json parser", async () => {
    const list = JSON.stringify({
      name: "JSON Strike Force",
      faction: "Adeptus Astartes",
      totalPoints: 2000,
      units: [
        { name: "Intercessors", models: 10, points: 200 },
        { name: "Captain", points: 105 },
      ],
    });
    const base64 = Buffer.from(list, "utf-8").toString("base64");
    const res = await createFileImport({
      filename: "army.json",
      base64,
      size: list.length,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await getImport(state.userId, res.data.importId);
    expect(row).not.toBeNull();
    expect(row!.sourceFormat).toBe("json");
    expect(row!.parserUsed).toBe("json");
    expect(row!.status).toBe("parsed");
    expect(row!.sourceTextPreview).toContain("JSON Strike Force");

    const tree = JSON.parse(row!.parsedTree!) as ImportedTree;
    expect(tree.armyName).toBe("JSON Strike Force");
    expect(tree.faction).toBe("Adeptus Astartes");
    expect(tree.totalPoints).toBe(2000);
    expect(tree.units).toEqual([
      { name: "Intercessors", count: 10, points: 200 },
      { name: "Captain", count: 1, points: 105 },
    ]);
  });

  test("createTextImport rejects empty input via the Zod schema", async () => {
    const res = await createTextImport({ rawText: "   " });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/paste your army list/i);
  });

  test("fetchImportForPreview returns ok + tree for the owner", async () => {
    const res = await createTextImport({
      rawText: "## Goff Waaagh\nFaction: Orks\n20 Boyz [180]\n",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const preview = await fetchImportForPreview(res.data.importId);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.tree.armyName).toBe("Goff Waaagh");
    expect(preview.import.parserUsed).toBe("text");
  });

  test("fetchImportForPreview returns ok:false for another user", async () => {
    const res = await createTextImport({
      rawText: "## A list\n10 Things\n",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const savedUserId = state.userId;
    state.userId = "different-user";
    try {
      const preview = await fetchImportForPreview(res.data.importId);
      expect(preview.ok).toBe(false);
    } finally {
      state.userId = savedUserId;
    }
  });

  test("listImports filters by status and orders newest-first", async () => {
    const now = Date.now();
    await state.db!.insert(imports).values([
      {
        ownerId: state.userId,
        sourceFormat: "plain-text",
        status: "applied",
        createdAt: new Date(now - 30_000),
        updatedAt: new Date(now - 30_000),
      },
      {
        ownerId: state.userId,
        sourceFormat: "pdf",
        status: "applied",
        createdAt: new Date(now - 10_000),
        updatedAt: new Date(now - 10_000),
      },
      {
        ownerId: state.userId,
        sourceFormat: "battlescribe-rosz",
        status: "failed",
        createdAt: new Date(now - 5_000),
        updatedAt: new Date(now - 5_000),
      },
    ]);

    const applied = await listImports(state.userId, { status: "applied" });
    expect(applied).toHaveLength(2);
    expect(applied[0]!.sourceFormat).toBe("pdf");
    expect(applied[1]!.sourceFormat).toBe("plain-text");

    const all = await listImports(state.userId);
    expect(all).toHaveLength(3);
    expect(all[0]!.status).toBe("failed");
  });
});

describe("applyImport", () => {
  test("creates an Army container + N Unit children + flips status to applied", async () => {
    // Seed: create a parsed import row directly so the test isn't
    // coupled to the parser pipeline.
    const tree: ImportedTree = {
      armyName: "Strike Force Bravo",
      totalPoints: 1990,
      faction: "Adeptus Astartes",
      units: [
        { name: "Captain", count: 1, points: 105 },
        { name: "Intercessors", count: 10, points: 200 },
        { name: "Tactical Marines", count: 10, points: 135 },
        { name: "Terminators", count: 5, points: 185 },
        { name: "Eradicators", count: 3, points: 100 },
      ],
    };
    const [importRow] = await state.db!
      .insert(imports)
      .values({
        ownerId: state.userId,
        sourceFormat: "plain-text",
        status: "parsed",
        parsedTree: JSON.stringify(tree),
        parserConfidence: 0.85,
        parserUsed: "text",
      })
      .returning();

    const res = await applyImport({
      importId: importRow!.id,
      editedTree: tree,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.armyProjectId).toBeTruthy();

    // Army row landed.
    const armyRows = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.id, res.data.armyProjectId));
    expect(armyRows).toHaveLength(1);
    expect(armyRows[0]!.type).toBe("Army");
    expect(armyRows[0]!.name).toBe("Strike Force Bravo");
    expect(armyRows[0]!.faction).toBe("Adeptus Astartes");
    expect(armyRows[0]!.pointsValue).toBe(1990);

    // Unit children landed with the correct parent.
    const children = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.parentId, res.data.armyProjectId));
    expect(children).toHaveLength(5);
    expect(children.every((c) => c.type === "Unit")).toBe(true);
    const childNames = children.map((c) => c.name).sort();
    expect(childNames).toEqual(
      [
        "Captain",
        "Eradicators",
        "Intercessors",
        "Tactical Marines",
        "Terminators",
      ].sort(),
    );
    const intercessors = children.find((c) => c.name === "Intercessors");
    expect(intercessors!.count).toBe(10);
    expect(intercessors!.pointsValue).toBe(200);

    // Import row flipped to applied + appliedProjectId set.
    const [reloaded] = await state.db!
      .select()
      .from(imports)
      .where(eq(imports.id, importRow!.id));
    expect(reloaded!.status).toBe("applied");
    expect(reloaded!.appliedProjectId).toBe(res.data.armyProjectId);
  });

  test("trims trailing whitespace from unit names before insert", async () => {
    const tree: ImportedTree = {
      armyName: "  Whitespace Army  ",
      units: [
        { name: "  Padded Unit  ", count: 5 },
      ],
    };
    const [importRow] = await state.db!
      .insert(imports)
      .values({
        ownerId: state.userId,
        sourceFormat: "plain-text",
        status: "parsed",
        parsedTree: JSON.stringify(tree),
        parserConfidence: 0.7,
        parserUsed: "text",
      })
      .returning();

    const res = await applyImport({
      importId: importRow!.id,
      editedTree: tree,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const army = (
      await state.db!
        .select()
        .from(projects)
        .where(eq(projects.id, res.data.armyProjectId))
    )[0]!;
    expect(army.name).toBe("Whitespace Army");

    const [child] = await state.db!
      .select()
      .from(projects)
      .where(eq(projects.parentId, res.data.armyProjectId));
    expect(child!.name).toBe("Padded Unit");
  });

  test("rejects a missing import row", async () => {
    const res = await applyImport({
      importId: "nonexistent-id-here",
      editedTree: {
        armyName: "X",
        units: [{ name: "Y", count: 1 }],
      },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/not found/i);
  });

  test("rejects a re-apply on an already-applied import", async () => {
    const tree: ImportedTree = {
      armyName: "Single Apply",
      units: [{ name: "Sole Unit", count: 1 }],
    };
    const [importRow] = await state.db!
      .insert(imports)
      .values({
        ownerId: state.userId,
        sourceFormat: "plain-text",
        status: "parsed",
        parsedTree: JSON.stringify(tree),
        parserConfidence: 0.8,
        parserUsed: "text",
      })
      .returning();

    const first = await applyImport({
      importId: importRow!.id,
      editedTree: tree,
    });
    expect(first.ok).toBe(true);

    const second = await applyImport({
      importId: importRow!.id,
      editedTree: tree,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/already been applied/i);
  });

  test("rejects an empty unit array via Zod", async () => {
    const tree: ImportedTree = { armyName: "Empty", units: [] };
    const [importRow] = await state.db!
      .insert(imports)
      .values({
        ownerId: state.userId,
        sourceFormat: "plain-text",
        status: "parsed",
        parsedTree: JSON.stringify(tree),
        parserConfidence: 0,
        parserUsed: "text",
      })
      .returning();

    const res = await applyImport({
      importId: importRow!.id,
      editedTree: tree,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/at least one unit/i);

    // Ensure NO orphan rows leaked.
    const orphanArmies = await state.db!
      .select()
      .from(projects)
      .where(
        and(eq(projects.ownerId, state.userId), isNotNull(projects.parentId)),
      );
    expect(orphanArmies).toHaveLength(0);
  });
});
