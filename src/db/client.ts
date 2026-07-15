// Explicit /node import so Turbopack doesn't pull the web-API variant,
// which rejects `file:` URLs.
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/local.db";

// Single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  __miniManagerLibsqlClient?: ReturnType<typeof createClient>;
};

const existingClient = globalForDb.__miniManagerLibsqlClient;

const client =
  existingClient ??
  createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

// E6 (O4) — SQLite leaves foreign-key enforcement OFF by default, so
// `ON DELETE CASCADE` / `RESTRICT` in the schema silently do nothing and
// deletes leave orphaned child rows. Enable it once on the fresh connection.
// Fire-and-forget (module init is sync) and swallow errors — harmless if the
// engine already has it on, and enforcement is best-effort on remote engines.
if (!existingClient) {
  void client.execute("PRAGMA foreign_keys = ON").catch(() => {
    /* older/remote engines may reject the pragma — nothing to do */
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__miniManagerLibsqlClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
