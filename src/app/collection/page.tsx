import "server-only";

import { currentUserId } from "@/lib/auth-stub";
import {
  listPaintCollection,
  listModelCollection,
  buildRecipesByPaintTitle,
  recipesForPaintTitle,
  collectionStats,
  listPaintTypesInUse,
} from "@/db/queries/collections";
import { listAllProjects } from "@/db/queries/projects";
import {
  paintCollectionStatuses,
  modelCollectionStatuses,
} from "@/db/schema";

import { AddBar } from "@/components/collections/AddBar";
import { TableFilter } from "@/components/collections/TableFilter";
import { PaintCollectionTable } from "@/components/collections/PaintCollectionTable";
import { ModelCollectionTable } from "@/components/collections/ModelCollectionTable";
import { StatsBar } from "@/components/collections/StatsBar";

export const dynamic = "force-dynamic";

function str(raw: string | string[] | undefined): string | null {
  return typeof raw === "string" && raw.length ? raw : null;
}

/**
 * COLLECTION page (/collection — FIGMA-REBUILD route; /wishlist and
 * /collections redirect here).
 *
 * TODO(collection agent, task #9): rebuild this surface per REBUILD_SPEC
 * §8 + docs/redesign-refs/Wishlist.png — COLLECTION PageHeader (yellow),
 * paste-URL add bar top-right, MY PAINT COLLECTION / MY MODEL COLLECTION
 * panels on the shared `.dt` table idiom. The markup below is the
 * PRE-rebuild surface kept functional in the interim; mine it for data
 * wiring only.
 *
 * Two tables — PAINT COLLECTION and MODEL COLLECTION — driven off the
 * single `wishlist_item` table, partitioned by `kind`. Each table has its
 * own filter button (namespaced URL params: pstatus/ptype for paints,
 * mstatus/mproject for models) and a bottom overview/stats bar sums the
 * whole collection.
 */
export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  const params = await searchParams;

  const paintStatus = str(params.pstatus);
  const paintType = str(params.ptype);
  const modelStatus = str(params.mstatus);
  const modelProject = str(params.mproject);

  const [
    paintItems,
    modelItems,
    recipeMap,
    projects,
    stats,
    paintTypesInUse,
  ] = await Promise.all([
    listPaintCollection(userId, { status: paintStatus, paintType }),
    listModelCollection(userId, { status: modelStatus, projectId: modelProject }),
    buildRecipesByPaintTitle(userId),
    listAllProjects(userId),
    collectionStats(userId),
    listPaintTypesInUse(userId),
  ]);

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  const paintRows = paintItems.map((item) => ({
    item,
    recipes: recipesForPaintTitle(item.title, recipeMap),
  }));

  return (
    <div className="flex flex-col h-screen">
      <header className="relative overflow-hidden px-6 md:px-8 pt-6 pb-4 border-b border-[var(--color-border)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
              SYS ▸ COLLECTIONS / 06
            </p>
            <h1 className="title-display text-base md:text-lg">COLLECTIONS</h1>
            <p className="text-xs text-[var(--color-fg-muted)] mt-3 font-sans leading-snug max-w-prose">
              Your paints and models — wanted, owned, and in progress. Paste a
              vendor URL to auto-fill a row, or type a name to add manually.
            </p>
          </div>
          <AddBar />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-8">
        {/* PAINT COLLECTION */}
        <section aria-label="Paint collection" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Paint collection · {paintItems.length}</h2>
            <TableFilter
              label="Filter"
              groups={[
                {
                  param: "pstatus",
                  label: "Status",
                  options: paintCollectionStatuses,
                },
                ...(paintTypesInUse.length
                  ? [{ param: "ptype", label: "Type", options: paintTypesInUse }]
                  : []),
              ]}
            />
          </div>
          {paintRows.length === 0 ? (
            <EmptyPanel
              label="PAINTS · 0"
              text="No paints match. Add a paint from a vendor URL or by name and it'll land here."
            />
          ) : (
            <PaintCollectionTable rows={paintRows} />
          )}
        </section>

        {/* MODEL COLLECTION */}
        <section aria-label="Model collection" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Model collection · {modelItems.length}</h2>
            <TableFilter
              label="Filter"
              groups={[
                {
                  param: "mstatus",
                  label: "Status",
                  options: modelCollectionStatuses,
                },
              ]}
            />
          </div>
          {modelItems.length === 0 ? (
            <EmptyPanel
              label="MODELS · 0"
              text="No models match. Add a kit, box, or mini from a vendor URL or by name."
            />
          ) : (
            <ModelCollectionTable items={modelItems} projects={projectOptions} />
          )}
        </section>
      </main>

      <StatsBar stats={stats} />
    </div>
  );
}

function EmptyPanel({ label, text }: { label: string; text: string }) {
  return (
    <div className="relative panel panel-ticks px-4 py-5 overflow-hidden">
      <span className="panel-label" aria-hidden>
        {label}
      </span>
      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        {text}
      </p>
    </div>
  );
}
