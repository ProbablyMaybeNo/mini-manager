/**
 * perf-lag fix — `getPaintMetaMap` catalog cache.
 *
 * Pins the behaviour that fixes the app-wide mutation lag: the static
 * ~1.6 MB / 7k-row catalog must be read + JSON-parsed at most ONCE per
 * process while its file mtime is unchanged. Every recipe / project /
 * library render — and the post-mutation `revalidatePath` re-render —
 * calls this; before the fix it paid a full `readFile` + `JSON.parse` +
 * 7k-entry Map rebuild every single call.
 *
 * We mock `node:fs/promises` so the test is hermetic: `stat` is cheap
 * and may be called per request, but `readFile` (the expensive path)
 * must only fire on a cold cache or after the mtime advances.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const statMock = vi.fn();
const readFileMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  stat: (...args: unknown[]) => statMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

const CATALOG = JSON.stringify({
  __exported_at: 111,
  __row_count: 2,
  paints: [
    { id: "a", brand: "Citadel", name: "Macragge Blue", hex: "#0a0a55" },
    { id: "b", brand: "Vallejo", name: "Heavy Red", hex: "#aa1111" },
  ],
});

async function freshGetPaintMetaMap() {
  vi.resetModules();
  const mod = await import("@/db/queries/recipes");
  return mod.getPaintMetaMap;
}

beforeEach(() => {
  statMock.mockReset();
  readFileMock.mockReset();
  readFileMock.mockResolvedValue(CATALOG);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPaintMetaMap caching", () => {
  test("builds the paintId -> { hex, label } map from the catalog", async () => {
    statMock.mockResolvedValue({ mtimeMs: 1000 });
    const getPaintMetaMap = await freshGetPaintMetaMap();

    const map = await getPaintMetaMap();
    expect(map.get("a")).toEqual({ hex: "#0a0a55", label: "Citadel Macragge Blue" });
    expect(map.get("b")).toEqual({ hex: "#aa1111", label: "Vallejo Heavy Red" });
  });

  test("reads + parses the catalog only once across many calls (warm mtime)", async () => {
    statMock.mockResolvedValue({ mtimeMs: 1000 });
    const getPaintMetaMap = await freshGetPaintMetaMap();

    await getPaintMetaMap();
    await getPaintMetaMap();
    await getPaintMetaMap();

    expect(readFileMock).toHaveBeenCalledTimes(1);
    // stat may run per call (it's the cheap key check) — that's fine.
    expect(statMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  test("returns the identical cached Map instance on a hit (no rebuild)", async () => {
    statMock.mockResolvedValue({ mtimeMs: 1000 });
    const getPaintMetaMap = await freshGetPaintMetaMap();

    const first = await getPaintMetaMap();
    const second = await getPaintMetaMap();
    expect(second).toBe(first);
  });

  test("re-reads when the file mtime advances (catalog rebuilt)", async () => {
    statMock
      .mockResolvedValueOnce({ mtimeMs: 1000 })
      .mockResolvedValueOnce({ mtimeMs: 2000 });
    const getPaintMetaMap = await freshGetPaintMetaMap();

    await getPaintMetaMap();
    await getPaintMetaMap();

    expect(readFileMock).toHaveBeenCalledTimes(2);
  });

  test("falls back to the cached map if a later stat throws", async () => {
    statMock
      .mockResolvedValueOnce({ mtimeMs: 1000 })
      .mockRejectedValueOnce(new Error("EBUSY"));
    const getPaintMetaMap = await freshGetPaintMetaMap();

    const first = await getPaintMetaMap();
    const second = await getPaintMetaMap();
    expect(second).toBe(first);
    // No second read — the stale-but-valid cache is served.
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });
});
