/**
 * Seed the public recipe gallery with a set of well-known starter schemes
 * so `/gallery` (and the `/r/<slug>` detail view) isn't empty at launch.
 *
 * Each recipe is a flat ordered list of slots — one paint + its layer
 * (`technique`) per slot — pinned to REAL paint ids from the static catalog
 * (`public/data/paints.json`). The recipes are published AND listed (both
 * `publicSlug` and `isListed` are set) so `listPublishedRecipes` surfaces
 * them — an ordinary user's shared recipe only gets the former.
 *
 * Idempotent: keyed by a stable `publicSlug`. Re-running deletes the recipe
 * row owned by the seed user for each slug (slots cascade) and re-inserts it,
 * so the gallery converges on this exact set without duplicating.
 *
 * NOT wired into build / prebuild — run it explicitly:
 *
 *   Local:
 *     npm run db:seed-gallery
 *
 *   Production (once — against the remote libsql/Turso DB):
 *     DATABASE_URL="libsql://<your-db>.turso.io" \
 *     DATABASE_AUTH_TOKEN="<token>" \
 *     npm run db:seed-gallery
 *
 *   (PowerShell:  $env:DATABASE_URL="…"; $env:DATABASE_AUTH_TOKEN="…"; npm run db:seed-gallery)
 *
 * Paint ids below are resolved against the catalog at runtime and the script
 * aborts loudly if any id is missing, so a future catalog re-scrape that drops
 * an id can't silently seed a colourless slot.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { TechniqueKey } from "@/db/schema";
import type { Paint, PaintCatalog } from "@/lib/paints/types";

/* ============================================================
   Seed identity
   ============================================================
   All seeded gallery recipes are owned by a single dedicated account so
   re-runs can scope their cleanup to "rows this seed owns" without ever
   touching a real painter's shared recipes. The user row is upserted
   (conflict-do-nothing) ahead of the recipes.
   ============================================================ */

const SEED_USER_ID = "gallery_seed__system";
const SEED_USER = {
  id: SEED_USER_ID,
  name: "The Mini Mainframe",
  username: "mini-mainframe-gallery",
} as const;

/* ============================================================
   Recipe definitions
   ============================================================
   Each slot is { technique (layer), paint (catalog id) } in paint order
   (undercoat → basecoat → … → highlight → wash → metallic). `note` is an
   optional per-slot technique note. `notesMd` is the scheme-level note the
   public `/r/<slug>` view renders under NOTES.
   ============================================================ */

interface SeedSlot {
  technique: TechniqueKey;
  /** Real catalog paint id (see resolvePaint). */
  paintId: string;
  /** Optional per-slot technique note. */
  note?: string;
}

interface SeedRecipe {
  slug: string;
  name: string;
  bodyType: schema.BodyType;
  notesMd: string;
  slots: SeedSlot[];
}

const RECIPES: SeedRecipe[] = [
  {
    slug: "ultramarines-classic",
    name: "Ultramarines — Classic Blue",
    bodyType: "infantry",
    notesMd:
      "The textbook Codex-blue Space Marine. Prime black, basecoat the armour, " +
      "shade into the recesses with a blue wash, then re-establish the base and " +
      "edge-highlight the plate. Two thin coats on the basecoat — don't fight " +
      "the wash with a thick first layer.",
    slots: [
      { technique: "undercoat", paintId: "16032", note: "Spray or brush a clean black undercoat." },
      { technique: "basecoat", paintId: "16162", note: "Two thin coats of Macragge Blue over the plate." },
      { technique: "wash", paintId: "16156", note: "Drakenhof Nightshade into the recesses only." },
      { technique: "midcoat", paintId: "16162", note: "Reclaim the raised armour after the wash." },
      { technique: "highlight", paintId: "16161", note: "Calgar Blue on the upper edges." },
      { technique: "edge_highlight", paintId: "16142", note: "Fine Fenrisian Grey line on the sharpest edges." },
      { technique: "metallic", paintId: "15963", note: "Auric Armour Gold for aquila + trim." },
    ],
  },
  {
    slug: "death-guard-rotting-plate",
    name: "Death Guard — Rotting Plate",
    bodyType: "infantry",
    notesMd:
      "Grimy plague-marine green with a corroded, sun-bleached finish. Build the " +
      "green up through two lighter tones, then dirty it back down with earthshade " +
      "and a stippled corrosion texture. Keep highlights scrappy — clean lines fight " +
      "the rot.",
    slots: [
      { technique: "undercoat", paintId: "16032" },
      { technique: "basecoat", paintId: "16049", note: "Death Guard Green over the plate." },
      { technique: "wash", paintId: "15975", note: "Agrax Earthshade all over to grime it." },
      { technique: "midcoat", paintId: "16037", note: "Ogryn Camo highlight, leaving the green in recesses." },
      { technique: "highlight", paintId: "16045", note: "Nurgling Green on the topmost edges." },
      { technique: "detail", paintId: "15987", note: "Stipple Typhus Corrosion for rust + grime patches." },
      { technique: "metallic", paintId: "16126", note: "Leadbelcher on rotted trim + exposed metal." },
    ],
  },
  {
    slug: "blood-angels-crimson",
    name: "Blood Angels — Crimson Host",
    bodyType: "infantry",
    notesMd:
      "Deep, glowing Blood Angels red. Start dark, basecoat the signature scarlet, " +
      "shade to push the recesses, then build the highlight back up to a bright " +
      "edge. Gold trim ties the whole scheme together.",
    slots: [
      { technique: "undercoat", paintId: "16032" },
      { technique: "basecoat", paintId: "15915", note: "Mephiston Red as the foundation tone." },
      { technique: "midcoat", paintId: "15842", note: "Blood Angels Red over most of the panel." },
      { technique: "wash", paintId: "16206", note: "Carroburg Crimson into the recesses." },
      { technique: "highlight", paintId: "15913", note: "Evil Sunz Scarlet on raised edges." },
      { technique: "edge_highlight", paintId: "16219", note: "Wild Rider Red on the finest edges." },
      { technique: "metallic", paintId: "15963", note: "Auric Armour Gold for trim + purity seals." },
    ],
  },
  {
    slug: "necrons-living-metal",
    name: "Necrons — Living Metal",
    bodyType: "infantry",
    notesMd:
      "The cold, gunmetal Necron look in four fast steps. A dark metal base, a heavy " +
      "all-over wash to sink the shadows, then a drybrush-style re-highlight up to " +
      "bright steel. Pick out the glowing green energy coils last so they pop against " +
      "the metal.",
    slots: [
      { technique: "undercoat", paintId: "16032" },
      { technique: "metallic", paintId: "16126", note: "Leadbelcher over the whole body." },
      { technique: "wash", paintId: "15975", note: "Agrax Earthshade all over to deepen the metal." },
      { technique: "highlight", paintId: "16146", note: "Ironbreaker drybrushed on the raised plate." },
      { technique: "edge_highlight", paintId: "16135", note: "Runefang Steel on the sharpest edges." },
      { technique: "detail", paintId: "16103", note: "Warpstone Glow for the energy coils + gauss flayer." },
    ],
  },
  {
    slug: "nurgle-daemons-plague",
    name: "Nurgle Daemons — Plague Flesh",
    bodyType: "monster",
    notesMd:
      "Sickly, swollen plaguebearer flesh. Build a pale rotten green over bone, shade " +
      "it green-brown so the folds read as bruised, then highlight back up. Glaze a " +
      "yellow tint into the belly for that diseased, jaundiced look.",
    slots: [
      { technique: "undercoat", paintId: "16015", note: "Wraithbone undercoat — keeps the flesh pale." },
      { technique: "basecoat", paintId: "16046", note: "Plaguebearer Flesh over the body." },
      { technique: "wash", paintId: "16105", note: "Biel-Tan Green into the deepest folds." },
      { technique: "midcoat", paintId: "16046", note: "Reclaim the raised flesh after the wash." },
      { technique: "highlight", paintId: "16036", note: "Athonian Camoshade glazed over the highest points." },
      { technique: "detail", paintId: "16020", note: "Nurgle's Rot for pustules + open sores." },
    ],
  },
  {
    slug: "speedpaint-one-coat-bones",
    name: "Speedpaint — One-Coat Skeletons",
    bodyType: "infantry",
    notesMd:
      "A batch-painting speedrun for rank-and-file skeletons. Prime bone-white, flood " +
      "a single contrast/speedpaint coat to do the shading for you, then a fast bone " +
      "drybrush brings the skulls and edges back up. Whole units in an evening — no " +
      "layering required.",
    slots: [
      { technique: "undercoat", paintId: "16015", note: "Wraithbone spray as the bright base." },
      { technique: "basecoat", paintId: "16013", note: "Skeleton Horde contrast — one flooding coat does the shade." },
      { technique: "highlight", paintId: "16023", note: "Quick Ushabti Bone drybrush over the contrast." },
      { technique: "edge_highlight", paintId: "15979", note: "Corax White catches the skull + bone tips." },
      { technique: "detail", paintId: "15935", note: "Wyldwood on hafts, leather + dark details." },
    ],
  },
  {
    slug: "khorne-berzerkers-brass-and-blood",
    name: "Khorne Berzerkers — Brass & Blood",
    bodyType: "infantry",
    notesMd:
      "Angry red armour and battered brass for the World Eaters. Build the red dark-to-" +
      "bright, shade the brass trim with earthshade, then finish with a blood effect on " +
      "the blades and the worst of the armour. Keep it messy — these are not parade models.",
    slots: [
      { technique: "undercoat", paintId: "16032" },
      { technique: "basecoat", paintId: "15917", note: "Khorne Red over the plate." },
      { technique: "midcoat", paintId: "15915", note: "Mephiston Red on the upper armour." },
      { technique: "highlight", paintId: "15913", note: "Evil Sunz Scarlet edge highlight." },
      { technique: "metallic", paintId: "15929", note: "Hashut Copper on the trim, chains + studs." },
      { technique: "wash", paintId: "15975", note: "Agrax Earthshade over the brass to age it." },
      { technique: "detail", paintId: "16217", note: "Blood for the Blood God on blades + battle damage." },
    ],
  },
  {
    slug: "stormcast-eternals-sigmarite-gold",
    name: "Stormcast Eternals — Sigmarite Gold",
    bodyType: "infantry",
    notesMd:
      "Bright heraldic gold for the Hammers of Sigmar, with a cool blue accent. Base a " +
      "warm gold, shade the recesses with earthshade, then climb back up through bright " +
      "gold to a silver edge. The blue shoulder cape keeps the gold from going flat.",
    slots: [
      { technique: "undercoat", paintId: "16032" },
      { technique: "metallic", paintId: "15999", note: "Balthasar Gold base over the armour." },
      { technique: "wash", paintId: "15975", note: "Agrax Earthshade into all the recesses." },
      { technique: "highlight", paintId: "15981", note: "Liberator Gold on the raised plate." },
      { technique: "edge_highlight", paintId: "16100", note: "Stormhost Silver on the sharpest edges." },
      { technique: "basecoat", paintId: "16153", note: "Ultramarines Blue on the cape + cloth accents." },
      { technique: "detail", paintId: "16137", note: "Lothern Blue highlight on the cloth." },
    ],
  },
];

/* ============================================================
   Catalog resolution
   ============================================================ */

async function loadCatalog(): Promise<Map<string, Paint>> {
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const raw = await readFile(file, "utf8");
  const catalog = JSON.parse(raw) as PaintCatalog;
  const byId = new Map<string, Paint>();
  for (const p of catalog.paints) byId.set(p.id, p);
  return byId;
}

/**
 * Fail loudly if any seed slot references a paint id the catalog no longer
 * has. Better to abort than to seed a colourless slot the gallery can't render.
 */
function assertPaintsExist(catalog: Map<string, Paint>): void {
  const missing: string[] = [];
  for (const recipe of RECIPES) {
    for (const slot of recipe.slots) {
      if (!catalog.has(slot.paintId)) {
        missing.push(`${recipe.slug} → paintId ${slot.paintId}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[seed-gallery] ${missing.length} slot(s) reference a paint id not in ` +
        `public/data/paints.json:\n  ${missing.join("\n  ")}`,
    );
  }
}

/* ============================================================
   Main
   ============================================================ */

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "file:./data/local.db";
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  console.log(`[seed-gallery] seeding ${RECIPES.length} recipes against ${url}`);

  const catalog = await loadCatalog();
  assertPaintsExist(catalog);

  // Upsert the dedicated seed owner.
  await db
    .insert(schema.users)
    .values({
      id: SEED_USER.id,
      name: SEED_USER.name,
      username: SEED_USER.username,
    })
    .onConflictDoNothing();

  for (const recipe of RECIPES) {
    // Idempotency: drop any prior seed recipe for this slug (slots cascade via
    // FK), scoped to the seed owner so a real painter's shared recipe is never
    // touched. publicSlug carries a UNIQUE index, so at most one row matches.
    await db
      .delete(schema.recipes)
      .where(
        and(
          eq(schema.recipes.ownerId, SEED_USER_ID),
          eq(schema.recipes.publicSlug, recipe.slug),
        ),
      );

    const insertedRecipe = await db
      .insert(schema.recipes)
      .values({
        ownerId: SEED_USER_ID,
        name: recipe.name,
        bodyType: recipe.bodyType,
        isStandalone: true,
        publicSlug: recipe.slug,
        // Curated seed recipes are the only ones that opt into the public
        // gallery grid — an ordinary user's "⬡ SHARE LINK" only mints a
        // publicSlug and leaves isListed false (see src/db/schema.ts).
        isListed: true,
        notesMd: recipe.notesMd,
      })
      .returning({ id: schema.recipes.id });

    const recipeId = insertedRecipe[0]?.id;
    if (!recipeId) {
      throw new Error(`[seed-gallery] insert returned no id for ${recipe.slug}`);
    }

    await db.insert(schema.recipeSlots).values(
      recipe.slots.map((slot, position) => ({
        recipeId,
        position,
        technique: slot.technique,
        paintId: slot.paintId,
        notesMd: slot.note ?? null,
      })),
    );

    console.log(
      `[seed-gallery]  ✓ ${recipe.slug} (${recipe.slots.length} slots) → /r/${recipe.slug}`,
    );
  }

  console.log(`[seed-gallery] done — ${RECIPES.length} published recipes`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
