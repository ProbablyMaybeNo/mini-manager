/**
 * perf-lag fix — `loadCatalogPaints` catalog cache.
 *
 * The PLANNER coverage-grid read path shared the same lag as
 * getPaintMetaMap: the cache key (__exported_at) lived inside the file,
 * so every call paid a full readFile + JSON.parse of the ~1.6MB / 7k-row
 * catalog. Pin that the expensive read now fires at most once per
 * process while the file mtime is unchanged.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const statMock = vi.fn();
const readFileMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  stat: (...args: unknown[]) => statMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

// paintCoverage imports the real DB client transitively; stub it so this
// stays a hermetic FS-cache unit test (we never call DB-bound exports).
vi.mock("@/db/client", () => ({ db: {} }));

const CATALOG = JSON.stringify({
  __exported_at: 222,
  __row_count: 2,
  paints: [
    { id: "a", brand: "Citadel", name: "Macragge Blue", hex: "#0a0a55" },
    { id: "b", brand: "Vallejo", name: "Heavy Red", hex: "#aa1111" },
  ],
});

async function freshLoadCatalogPaints() {
  vi.resetModules();
  const mod = await import("@/db/queries/paintCoverage");
  return mod.loadCatalogPaints;
}

beforeEach(() => {
  statMock.mockReset();
  readFileMock.mockReset();
  readFileMock.mockResolvedValue(CATALOG);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadCatalogPaints caching", () => {
  test("returns the parsed paints array", async () => {
    statMock.mockResolvedValue({ mtimeMs: 1000 });
    const loadCatalogPaints = await freshLoadCatalogPaints();

    const paints = await loadCatalogPaints();
    expect(paints.map((p) => p.id)).toEqual(["a", "b"]);
  });

  test("reads + parses only once across many calls (warm mtime)", async () => {
    statMock.mockResolvedValue({ mtimeMs: 1000 });
    const loadCatalogPaints = await freshLoadCatalogPaints();

    await loadCatalogPaints();
    await loadCatalogPaints();
    await loadCatalogPaints();

    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  test("returns the identical cached array instance on a hit", async () => {
    statMock.mockResolvedValue({ mtimeMs: 1000 });
    const loadCatalogPaints = await freshLoadCatalogPaints();

    const first = await loadCatalogPaints();
    const second = await loadCatalogPaints();
    expect(second).toBe(first);
  });

  test("re-reads when the file mtime advances", async () => {
    statMock
      .mockResolvedValueOnce({ mtimeMs: 1000 })
      .mockResolvedValueOnce({ mtimeMs: 2000 });
    const loadCatalogPaints = await freshLoadCatalogPaints();

    await loadCatalogPaints();
    await loadCatalogPaints();

    expect(readFileMock).toHaveBeenCalledTimes(2);
  });

  test("falls back to the cached array if a later stat throws", async () => {
    statMock
      .mockResolvedValueOnce({ mtimeMs: 1000 })
      .mockRejectedValueOnce(new Error("EBUSY"));
    const loadCatalogPaints = await freshLoadCatalogPaints();

    const first = await loadCatalogPaints();
    const second = await loadCatalogPaints();
    expect(second).toBe(first);
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });
});
