import "server-only";

import { currentUserId } from "@/lib/auth-stub";
import {
  listPaintCollection,
  listModelCollection,
  buildRecipesByPaintTitle,
  recipesForPaintTitle,
} from "@/db/queries/collections";
import { listAllProjects } from "@/db/queries/projects";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddUrlBar } from "@/components/collection/AddUrlBar";
import { PaintCollectionTable } from "@/components/collection/PaintCollectionTable";
import { ModelCollectionTable } from "@/components/collection/ModelCollectionTable";

export const dynamic = "force-dynamic";

function str(raw: string | string[] | undefined): string | null {
  return typeof raw === "string" && raw.length ? raw : null;
}

/**
 * COLLECTION page (/collection — FIGMA-REBUILD §8).
 * `/wishlist` and `/collections` redirect here.
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

  const [paintItems, modelItems, recipeMap, projects] = await Promise.all([
    listPaintCollection(userId, { status: paintStatus, paintType }),
    listModelCollection(userId, { status: modelStatus, projectId: modelProject }),
    buildRecipesByPaintTitle(userId),
    listAllProjects(userId),
  ]);

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  const paintRows = paintItems.map((item) => ({
    item,
    recipes: recipesForPaintTitle(item.title, recipeMap),
  }));

  return (
    <div className="px-4 py-6 md:px-8 space-y-8">
      <PageHeader
        title="COLLECTION"
        accent="yellow"
        tagline="Track and manage your paint and model collections — wanted, owned, and in progress."
      >
        <AddUrlBar />
      </PageHeader>

      <section aria-label="Paint collection" className="space-y-3">
        <header>
          <h2 className="section-title text-[var(--color-green)]">
            MY PAINT COLLECTION
          </h2>
          <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
            TRACK AND MANAGE YOUR PAINT COLLECTION
          </p>
        </header>
        {paintRows.length === 0 ? (
          <EmptyPanel text="NO PAINTS YET — PASTE A URL OR USE + PAINT TO ADD ONE." />
        ) : (
          <PaintCollectionTable rows={paintRows} />
        )}
      </section>

      <section aria-label="Model collection" className="space-y-3">
        <header>
          <h2 className="section-title text-[var(--color-green)]">
            MY MODEL COLLECTION
          </h2>
          <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
            TRACK AND MANAGE YOUR MODEL COLLECTION
          </p>
        </header>
        {modelItems.length === 0 ? (
          <EmptyPanel text="NO MODELS YET — PASTE A URL OR USE + MODELS TO ADD ONE." />
        ) : (
          <ModelCollectionTable items={modelItems} projects={projectOptions} />
        )}
      </section>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="panel panel-ticks relative px-4 py-5 overflow-hidden">
      <span className="panel-label" aria-hidden>
        EMPTY
      </span>
      <p className="font-mono text-xs text-[var(--color-fg-muted)]">{text}</p>
    </div>
  );
}
