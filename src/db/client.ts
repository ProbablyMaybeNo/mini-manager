import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/local.db";

// Single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  __miniManagerLibsqlClient?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.__miniManagerLibsqlClient ??
  createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__miniManagerLibsqlClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
