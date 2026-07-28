/**
 * Extra seed data for the landing-page showcase captures ONLY.
 *
 * `npm run db:seed` gives the dev account a project tree but an empty
 * collection and a one-step recipe, which made two of the six marketing
 * screenshots look like a broken app. This tops the dev user up with a
 * realistic collection (owned + wishlisted paints and models, with prices)
 * and a full five-layer recipe, then `tests/e2e/capture_showcase.spec.ts`
 * photographs the result.
 *
 * Local only — run against data/local.db, never a deployed database.
 *   npx tsx scripts/seed-showcase.mts
 */
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema";

const OWNER = "dev_user__local";

/** Catalog ids resolved from public/data/paints.json (Citadel line). */
const PAINTS = [
  { paintId: "16032", name: "Abaddon Black", technique: "undercoat" as const },
  { paintId: "16110", name: "Caliban Green", technique: "basecoat" as const },
  { paintId: "15843", name: "Nuln Oil", technique: "wash" as const },
  { paintId: "16023", name: "Ushabti Bone", technique: "highlight" as const },
  { paintId: "15984", name: "Retributor Armour", technique: "metallic" as const },
];

const COLLECTION_PAINTS = [
  { title: "Macragge Blue", paintId: "16162", type: "Base", price: 495, status: "OWNED" },
  { title: "Abaddon Black", paintId: "16032", type: "Base", price: 495, status: "OWNED" },
  { title: "Caliban Green", paintId: "16110", type: "Base", price: 495, status: "OWNED" },
  { title: "Nuln Oil", paintId: "15843", type: "Shade", price: 780, status: "OWNED" },
  { title: "Retributor Armour", paintId: "15984", type: "Layer", price: 550, status: "OWNED" },
  { title: "Ushabti Bone", paintId: "16023", type: "Layer", price: 550, status: "OWNED" },
  { title: "Mephiston Red", paintId: "15915", type: "Base", price: 495, status: "WISHLIST" },
  { title: "Leadbelcher", paintId: "16126", type: "Base", price: 495, status: "WISHLIST" },
];

const COLLECTION_MODELS = [
  { title: "Salamanders Firestrike Servo-turret", army: "Adeptus Astartes", price: 5500, status: "OWNED" },
  { title: "Intercessor Squad", army: "Adeptus Astartes", price: 4500, status: "BUILT" },
  { title: "Ork Boyz", army: "Orks", price: 3800, status: "PRIMED" },
  { title: "Aggressor Squad", army: "Adeptus Astartes", price: 5000, status: "WISHLIST" },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "file:./data/local.db";
  if (!url.startsWith("file:")) {
    throw new Error(`refusing to run against a non-local database: ${url}`);
  }
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  console.log(`[showcase] seeding against ${url}`);

  // Collection rows — wipe ours first so re-runs stay idempotent.
  await db.delete(schema.wishlistItems).where(eq(schema.wishlistItems.ownerId, OWNER));
  await db.insert(schema.wishlistItems).values([
    ...COLLECTION_PAINTS.map((p) => ({
      id: nanoid(16),
      ownerId: OWNER,
      title: p.title,
      kind: "paint" as const,
      category: "Paint" as const,
      company: "Citadel",
      paintType: p.type,
      paintId: p.paintId,
      price: p.price,
      status: p.status as never,
    })),
    ...COLLECTION_MODELS.map((m) => ({
      id: nanoid(16),
      ownerId: OWNER,
      title: m.title,
      kind: "model" as const,
      category: "Box" as const,
      game: "Warhammer 40,000",
      army: m.army,
      price: m.price,
      status: m.status as never,
    })),
  ]);

  // A five-layer recipe on the existing Salamanders army.
  const [army] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.name, "Salamanders 2k"))
    .limit(1);

  await db.delete(schema.recipes).where(eq(schema.recipes.ownerId, OWNER));
  const recipeId = nanoid(16);
  await db.insert(schema.recipes).values({
    id: recipeId,
    ownerId: OWNER,
    name: "Salamanders Green Scheme",
    attachedProjectId: army?.id ?? null,
  });
  await db.insert(schema.recipeSlots).values(
    PAINTS.map((p, i) => ({
      id: nanoid(16),
      recipeId,
      position: i,
      technique: p.technique,
      paintId: p.paintId,
    })),
  );

  console.log("[showcase] done");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
