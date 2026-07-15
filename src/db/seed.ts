import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { nanoid } from "nanoid";
import * as schema from "./schema";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "file:./data/local.db";
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  console.log(`[seed] seeding against ${url}`);

  // Dev user — replaced by real auth in Phase 1.3.
  const devUserId = "dev_user__local";
  await db
    .insert(schema.users)
    .values({
      id: devUserId,
      email: "dev@local",
      name: "Ross (dev)",
      username: "ross",
    })
    .onConflictDoNothing();

  // A small project tree: an Army with two child Units. Enough
  // variety to render the UI properly.
  const armyId = nanoid(16);
  const tacSquadId = nanoid(16);
  const orkBoyzId = nanoid(16);

  await db
    .insert(schema.projects)
    .values([
      {
        id: armyId,
        ownerId: devUserId,
        type: "Army",
        name: "Salamanders 2k",
        count: 0,
        faction: "Adeptus Astartes",
        priority: "High",
      },
      {
        id: tacSquadId,
        ownerId: devUserId,
        parentId: armyId,
        type: "Unit",
        name: "Tactical Squad Alpha",
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 6,
        paintCount: 3,
        baseCount: 1,
        completeCount: 0,
        faction: "Adeptus Astartes",
        priority: "High",
      },
      {
        id: orkBoyzId,
        ownerId: devUserId,
        type: "Unit",
        name: "Ork Boyz Mob",
        count: 20,
        ownedCount: 12,
        buildCount: 5,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        faction: "Orks",
        priority: "Medium",
      },
    ])
    .onConflictDoNothing();

  console.log("[seed] done");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
