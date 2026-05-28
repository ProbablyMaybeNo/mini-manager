import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { nanoid } from "nanoid";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@/db/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "..", "drizzle");

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Make a fresh in-memory libsql DB with all migrations applied and a
 * single test user seeded. Each integration test gets its own DB —
 * libsql in-memory instances are cheap, total setup is ~30ms per test.
 *
 * Returns the drizzle handle + the seeded user id. The caller is
 * expected to plug this into the `@/db/client` and `@/lib/auth-stub`
 * mocks at the top of the test file. See tests/integration/actions/
 * for the boilerplate pattern.
 */
export async function makeTestDb(): Promise<{
  db: TestDb;
  userId: string;
}> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  const userId = nanoid(16);
  await db.insert(schema.users).values({
    id: userId,
    email: `test-${userId}@example.com`,
    name: "Test User",
  });

  return { db, userId };
}

/**
 * Register an additional user — used by cross-ownership tests that need
 * to seed a row belonging to a second person (FKs on the projects /
 * recipes / etc. tables require the user row to exist).
 */
export async function seedExtraUser(
  db: TestDb,
  hint = "other",
): Promise<string> {
  const userId = nanoid(16);
  await db.insert(schema.users).values({
    id: userId,
    email: `${hint}-${userId}@example.com`,
    name: `${hint} user`,
  });
  return userId;
}
