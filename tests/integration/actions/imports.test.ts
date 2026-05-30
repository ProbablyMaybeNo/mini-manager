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

const { getImport, listImports } = await import("@/db/queries/imports");

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
