"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CollectionView, type CollectionStatus } from "@/components/collection/CollectionView";
import { PromptDialog, useToast } from "@/components/kit";
import { RecipePickerDialog } from "@/components/recipe/RecipePickerDialog";
import { useMockData } from "@/mock/MockProvider";
import type { CollectionItem, CollectionKind, ProjectStatus } from "@/lib/types";
import {
  setWishlistStatus,
  updateWishlistItem,
  deleteWishlistItem,
  createWishlistItem,
  scrapeAndCreateWishlistItem,
} from "@/lib/actions/wishlist";
import type { WishlistItem } from "@/db/schema";

/** kit ProjectStatus → DB wishlist status (collection rows persist on the
 *  wishlist_item table, whose lifecycle uses BUILT/PRIMED/… labels). */
const TO_DB_STATUS: Record<ProjectStatus, string> = {
  WISHLIST: "WISHLIST",
  OWNED: "OWNED",
  BUILDING: "BUILT",
  PRIMING: "PRIMED",
  PAINTING: "PAINTED",
  BASING: "BASED",
  COMPLETE: "COMPLETE",
  SHELVED: "HOLD",
};

/** DB wishlist status → kit ProjectStatus (reverse of TO_DB_STATUS, plus
 *  the lifecycle labels the picker doesn't emit). Mirrors appData's
 *  server-side map so optimistically-added rows render identically. */
const FROM_DB_STATUS: Record<string, ProjectStatus> = {
  WISHLIST: "WISHLIST",
  OWNED: "OWNED",
  HOLD: "SHELVED",
  BUILT: "BUILDING",
  PRIMED: "PRIMING",
  PAINTED: "PAINTING",
  BASED: "BASING",
  COMPLETE: "COMPLETE",
  PURCHASED: "OWNED",
};

/** Map a persisted wishlist row to the kit's CollectionItem so a freshly
 *  added item can drop straight into local state without a round-trip. */
function toCollectionItem(i: WishlistItem): CollectionItem {
  return {
    id: i.id,
    kind: i.kind,
    thumbnail: i.imageUrl ?? "",
    name: i.title,
    company: i.company ?? "",
    vendor: i.vendor ?? "",
    game: i.game ?? undefined,
    army: i.army ?? undefined,
    price: i.price != null ? `$${(i.price / 100).toFixed(2)}` : "",
    status: FROM_DB_STATUS[i.status ?? "WISHLIST"] ?? "WISHLIST",
    sourceUrl: i.sourceUrl ?? "",
    projectId: i.projectId ?? undefined,
    recipeId: i.recipeId ?? undefined,
    paintType: i.paintType ?? undefined,
  };
}

function CollectionRoute() {
  const data = useMockData();
  const router = useRouter();
  const { toast, node } = useToast();
  const preview = useSearchParams().get("state");
  const isEmpty = preview === "empty";
  const status: CollectionStatus =
    preview === "loading" ? "loading" : preview === "error" ? "error" : "ready";
  const [, startTransition] = useTransition();

  const [paints, setPaints] = useState<CollectionItem[]>(
    isEmpty ? [] : data.collectionPaints,
  );
  const [models, setModels] = useState<CollectionItem[]>(
    isEmpty ? [] : data.collectionModels,
  );

  /** Which manual-add dialog is open ("paint"/"model") — null when closed. */
  const [adding, setAdding] = useState<CollectionKind | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  /** The row whose rename (ACTIONS pen) dialog is open — null when closed. */
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  /** The paint row whose recipe-attach picker is open — null when closed. */
  const [attaching, setAttaching] = useState<CollectionItem | null>(null);

  /** Recipe options + swatch resolver, derived from the loaded recipes. */
  const recipeOptions = data.recipes.map((r) => ({
    id: r.id,
    name: r.name,
    swatches: r.slots.map((s) => s.swatch),
  }));
  const recipeSwatches = (recipeId: string) =>
    data.recipes.find((r) => r.id === recipeId)?.slots.map((s) => s.swatch) ?? [];

  const patch = (item: CollectionItem, fields: Partial<CollectionItem>) => {
    const apply = (list: CollectionItem[]) =>
      list.map((x) => (x.id === item.id ? { ...x, ...fields } : x));
    if (item.kind === "paint") setPaints(apply);
    else setModels(apply);
  };

  /** Drop a freshly persisted row into the right local column. */
  const absorb = (item: CollectionItem) => {
    if (item.kind === "paint") setPaints((l) => [item, ...l]);
    else setModels((l) => [item, ...l]);
  };

  function addManual(title: string) {
    const kind = adding;
    if (!kind) return;
    setAddError(null);
    startTransition(async () => {
      const res = await createWishlistItem({ title, kind });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      absorb(toCollectionItem(res.data));
      setAdding(null);
      toast(`Added ${title}`, "green");
    });
  }

  function addUrl(url: string, kind: CollectionKind) {
    startTransition(async () => {
      // MM-36 — pass the selected Paint/Model kind so the scraped row
      // lands in the table the painter chose, not whatever the title
      // heuristic guessed.
      const res = await scrapeAndCreateWishlistItem({ url, kind });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      absorb(toCollectionItem(res.data));
      toast(`Added ${res.data.title}`, "green");
    });
  }

  function renameItem(title: string) {
    const item = editing;
    if (!item) return;
    setEditError(null);
    patch(item, { name: title });
    setEditing(null);
    startTransition(async () => {
      const res = await updateWishlistItem({ id: item.id, title });
      if (res.ok) toast(`Renamed to ${title}`, "green");
      else toast(res.error, "red");
    });
  }

  function attachRecipe(recipeId: string) {
    const item = attaching;
    if (!item) return;
    patch(item, { recipeId });
    setAttaching(null);
    const name = data.recipes.find((r) => r.id === recipeId)?.name ?? "recipe";
    startTransition(async () => {
      const res = await updateWishlistItem({ id: item.id, recipeId });
      if (res.ok) toast(`Attached ${name}`, "green");
      else toast(res.error, "red");
    });
  }

  return (
    <>
    <CollectionView
      paints={paints}
      models={models}
      projects={data.projects}
      status={status}
      recipeSwatches={recipeSwatches}
      onAddUrl={(url, kind) => addUrl(url, kind)}
      onStatusChange={(item, s: ProjectStatus) => {
        patch(item, { status: s });
        startTransition(async () => {
          await setWishlistStatus({ id: item.id, status: TO_DB_STATUS[s] as never });
        });
      }}
      onAssignProject={(item, projectId) => {
        patch(item, { projectId: projectId || undefined });
        startTransition(async () => {
          await updateWishlistItem({ id: item.id, projectId: projectId || null });
        });
      }}
      onAttachRecipe={(item) => setAttaching(item)}
      onEdit={(item) => {
        setEditError(null);
        setEditing(item);
      }}
      onRemove={(item) => {
        if (item.kind === "paint") setPaints((l) => l.filter((x) => x.id !== item.id));
        else setModels((l) => l.filter((x) => x.id !== item.id));
        startTransition(async () => {
          await deleteWishlistItem({ id: item.id });
        });
      }}
      onAddPaint={() => setAdding("paint")}
      onAddModel={() => setAdding("model")}
      onRetry={() => router.refresh()}
    />
    <PromptDialog
      open={adding !== null}
      title={adding === "model" ? "Add model" : "Add paint"}
      breadcrumb="COLLECTION"
      label={adding === "model" ? "Model name" : "Paint name"}
      placeholder={adding === "model" ? "e.g. Intercessor Squad" : "e.g. Macragge Blue"}
      submitLabel="Add"
      error={addError}
      onSubmit={addManual}
      onClose={() => {
        setAdding(null);
        setAddError(null);
      }}
    />
    <PromptDialog
      open={editing !== null}
      title={editing?.kind === "model" ? "Rename model" : "Rename paint"}
      breadcrumb="COLLECTION"
      label="Name"
      defaultValue={editing?.name ?? ""}
      placeholder={editing?.kind === "model" ? "e.g. Intercessor Squad" : "e.g. Macragge Blue"}
      submitLabel="Save"
      error={editError}
      onSubmit={renameItem}
      onClose={() => {
        setEditing(null);
        setEditError(null);
      }}
    />
    <RecipePickerDialog
      open={attaching !== null}
      recipes={recipeOptions}
      onPick={attachRecipe}
      onCreateNew={() => router.push("/recipes/new")}
      onClose={() => setAttaching(null)}
    />
    {node}
    </>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <CollectionRoute />
    </Suspense>
  );
}
