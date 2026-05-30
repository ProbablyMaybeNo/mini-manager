import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { imports } from "@/db/schema";
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
const { createTextImport, fetchImportForPreview } = await import(
  "@/lib/actions/imports"
);

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
