import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * E6 (O4) — the db client must turn on SQLite foreign-key enforcement on a
 * fresh connection, so schema `ON DELETE CASCADE` / `RESTRICT` actually fire.
 */

const execute = vi.fn(async () => ({ rows: [] }));
const createClient = vi.fn(() => ({ execute }));

vi.mock("@libsql/client/node", () => ({ createClient }));
// drizzle just wraps the client; a passthrough keeps the import side-effect free.
vi.mock("drizzle-orm/libsql", () => ({ drizzle: (c: unknown) => c }));

const CACHE_KEY = "__miniManagerLibsqlClient";

beforeEach(() => {
  execute.mockClear();
  createClient.mockClear();
  vi.resetModules();
  // Clear the hot-reload cache so the module treats this as a fresh connection.
  delete (globalThis as Record<string, unknown>)[CACHE_KEY];
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[CACHE_KEY];
});

describe("db client FK enforcement", () => {
  test("issues PRAGMA foreign_keys = ON on a fresh connection", async () => {
    await import("@/db/client");
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith("PRAGMA foreign_keys = ON");
  });
});
