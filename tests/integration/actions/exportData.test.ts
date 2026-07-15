import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import {
  activityLog,
  events,
  feedback,
  imports,
  inspoImages,
  inventoryEntries,
  paintNotes,
  paintSessions,
  palettes,
  projectImages,
  projects,
  recipeInspo,
  recipes,
  recipeSlots,
  recipeStepCompletion,
  wishlistItems,
} from "@/db/schema";

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

const { exportAllUserData } = await import("@/lib/actions/exportData");

async function seedFullUser(userId: string) {
  // Seed a single user's full content surface.
  const projectId = nanoid(16);
  await state.db!.insert(projects).values({
    id: projectId,
    ownerId: userId,
    type: "Unit",
    name: "Salamanders Squad",
    count: 10,
  });

  const recipeId = nanoid(16);
  await state.db!.insert(recipes).values({
    id: recipeId,
    ownerId: userId,
    name: "Power Armor",
    bodyType: "infantry",
    isStandalone: false,
    attachedProjectId: projectId,
  });

  const slotId = nanoid(16);
  await state.db!.insert(recipeSlots).values({
    id: slotId,
    recipeId,
    position: 0,
    technique: "basecoat",
    paintId: "citadel-caliban-green",
  });

  await state.db!.insert(palettes).values({
    id: nanoid(16),
    ownerId: userId,
    name: "Saved Greens",
    source: "manual",
    colorHexes: JSON.stringify(["#0F4A33", "#1F8044"]),
    paintIds: JSON.stringify(["citadel-caliban-green", null]),
  });

  await state.db!.insert(inventoryEntries).values({
    id: nanoid(16),
    ownerId: userId,
    paintId: "citadel-caliban-green",
    ownedCount: 1,
  });

  await state.db!.insert(wishlistItems).values({
    id: nanoid(16),
    ownerId: userId,
    title: "Salamanders codex",
    category: "Other",
  });

  // --- the 10 tables G1 adds to the export ---
  await state.db!.insert(recipeInspo).values({
    id: nanoid(16),
    recipeId,
    position: 0,
    url: "https://example.com/edge-highlight-tutorial",
  });

  await state.db!.insert(recipeStepCompletion).values({
    id: nanoid(16),
    userId,
    stepId: slotId,
  });

  await state.db!.insert(paintNotes).values({
    id: nanoid(16),
    userId,
    paintId: "citadel-caliban-green",
    note: "Thin it 2:1",
  });

  await state.db!.insert(paintSessions).values({
    id: nanoid(16),
    userId,
    projectId,
    startedAt: new Date(),
  });

  await state.db!.insert(events).values({
    id: nanoid(16),
    userId,
    name: "Paint night",
    eventDate: new Date(),
    kind: "deadline",
  });

  await state.db!.insert(activityLog).values({
    id: nanoid(16),
    userId,
    kind: "project_created",
    refId: projectId,
  });

  await state.db!.insert(projectImages).values({
    id: nanoid(16),
    projectId,
    ownerId: userId,
    url: "https://teststore.public.blob.vercel-storage.com/project-images/x/1.png",
    pathname: "project-images/x/1.png",
  });

  await state.db!.insert(inspoImages).values({
    id: nanoid(16),
    userId,
    url: "https://example.com/inspiration.jpg",
  });

  await state.db!.insert(imports).values({
    id: nanoid(16),
    ownerId: userId,
    sourceFormat: "plain-text",
  });

  await state.db!.insert(feedback).values({
    id: nanoid(16),
    userId,
    message: "Love the app",
  });

  return { projectId, recipeId, slotId };
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("exportAllUserData", () => {
  test("includes every top-level section + version + timestamp", async () => {
    await seedFullUser(state.userId);

    const res = await exportAllUserData();
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const payload = res.data;
    // G1 bumped the export schema to v4 — all 16 owner-scoped tables.
    expect(payload.__exportVersion).toBe(4);
    expect(typeof payload.__exportedAt).toBe("string");
    expect(payload.projects).toHaveLength(1);
    expect(payload.recipes).toHaveLength(1);
    expect(payload.recipeSlots).toHaveLength(1);
    expect(payload.recipeInspo).toHaveLength(1);
    expect(payload.recipeStepCompletion).toHaveLength(1);
    expect(payload.palettes).toHaveLength(1);
    expect(payload.inventoryEntries).toHaveLength(1);
    expect(payload.wishlistItems).toHaveLength(1);
    expect(payload.paintNotes).toHaveLength(1);
    expect(payload.paintSessions).toHaveLength(1);
    expect(payload.events).toHaveLength(1);
    expect(payload.activityLog).toHaveLength(1);
    expect(payload.projectImages).toHaveLength(1);
    expect(payload.inspoImages).toHaveLength(1);
    expect(payload.imports).toHaveLength(1);
    expect(payload.feedback).toHaveLength(1);
  });

  test("isolates owners — Alice's export does NOT include Bob's rows", async () => {
    const aliceId = state.userId;
    await seedFullUser(aliceId);

    // Add a second user with their own content.
    const bobId = await seedExtraUser(state.db!, "bob");
    state.userId = bobId;
    await seedFullUser(bobId);

    // Run export as Alice.
    state.userId = aliceId;
    const res = await exportAllUserData();
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Each section has exactly one row (Alice's), not two — including the
    // tables scoped by userId and the recipe-child tables scoped by recipe id.
    expect(res.data.projects).toHaveLength(1);
    expect(res.data.recipes).toHaveLength(1);
    expect(res.data.palettes).toHaveLength(1);
    expect(res.data.inventoryEntries).toHaveLength(1);
    expect(res.data.wishlistItems).toHaveLength(1);
    expect(res.data.paintNotes).toHaveLength(1);
    expect(res.data.activityLog).toHaveLength(1);
    expect(res.data.projectImages).toHaveLength(1);
    expect(res.data.imports).toHaveLength(1);
    expect(res.data.recipeInspo).toHaveLength(1);
    expect(res.data.recipeStepCompletion).toHaveLength(1);

    // Sanity: the only project row's ownerId is Alice's id.
    expect((res.data.projects[0] as { ownerId?: string }).ownerId).toBe(aliceId);
  });

  test("converts Date timestamps to ISO strings", async () => {
    await seedFullUser(state.userId);
    const res = await exportAllUserData();
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const recipe = res.data.recipes[0] as { createdAt?: unknown };
    expect(typeof recipe.createdAt).toBe("string");
    // Round-trip should parse.
    expect(new Date(recipe.createdAt as string).toString()).not.toBe(
      "Invalid Date",
    );
  });
});
