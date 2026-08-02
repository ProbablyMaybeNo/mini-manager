"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CollectionView, type CollectionStatus } from "@/components/collection/CollectionView";
import type {
  ConfirmedScanPaint,
  ConfirmScanOutcome,
  ScanPhotoOutcome,
} from "@/components/collection/ScanPaintsFlow";
import { PromptDialog, useToast } from "@/components/kit";
import { RecipePickerDialog } from "@/components/recipe/RecipePickerDialog";
import type {
  CollectionItem,
  CollectionKind,
  Project,
  ProjectStatus,
  Recipe,
} from "@/lib/types";
import type { ScanImageMediaType } from "@/lib/paints/scanLimits";
import type { BulkOwnershipStatus } from "@/lib/paints/ownership";
import { toCollectionItem } from "@/lib/collection/mapWishlistItem";
import { storeLabelForUrl } from "@/lib/scrape/stores";
import {
  setWishlistStatus,
  updateWishlistItem,
  deleteWishlistItem,
  createWishlistItem,
  scrapeAndCreateWishlistItem,
} from "@/lib/actions/wishlist";
import { scanPaintsFromPhoto } from "@/lib/actions/paintScan";
import { bulkAddPaintsToCollection } from "@/lib/actions/paintOwnership";

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

function CollectionRoute({
  collectionPaints,
  collectionModels,
  projects,
  recipes,
}: CollectionData) {
  const router = useRouter();
  const { toast, node } = useToast();
  const preview = useSearchParams().get("state");
  const isEmpty = preview === "empty";
  const status: CollectionStatus =
    preview === "loading" ? "loading" : preview === "error" ? "error" : "ready";
  const [, startTransition] = useTransition();

  const [paints, setPaints] = useState<CollectionItem[]>(
    isEmpty ? [] : collectionPaints,
  );
  const [models, setModels] = useState<CollectionItem[]>(
    isEmpty ? [] : collectionModels,
  );

  /** Which manual-add dialog is open ("paint"/"model") — null when closed. */
  const [adding, setAdding] = useState<CollectionKind | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  /** R2-4 — the URL whose scrape failed, held so the row the painter types
   *  next carries the link they pasted instead of it being thrown away. */
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  /** The row whose rename (ACTIONS pen) dialog is open — null when closed. */
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  /** The paint row whose recipe-attach picker is open — null when closed. */
  const [attaching, setAttaching] = useState<CollectionItem | null>(null);

  /** Recipe options + swatch resolver, derived from the loaded recipes. */
  const recipeOptions = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    swatches: r.slots.map((s) => s.swatch),
  }));
  const recipeSwatches = (recipeId: string) =>
    recipes.find((r) => r.id === recipeId)?.slots.map((s) => s.swatch) ?? [];

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

  /** Close the manual-add dialog and drop any carried-over paste state. */
  function closeAdd() {
    setAdding(null);
    setAddError(null);
    setPendingUrl(null);
  }

  function addManual(title: string) {
    const kind = adding;
    if (!kind) return;
    setAddError(null);
    startTransition(async () => {
      // R2-4 — when this dialog was opened by a scrape that couldn't read the
      // page, the pasted link rides onto the row. The painter typed the name
      // themselves, but the link (and the store it came from) is still theirs
      // and is what makes the row worth having.
      const res = await createWishlistItem({
        title,
        kind,
        sourceUrl: pendingUrl,
        vendor: pendingUrl ? storeLabelForUrl(pendingUrl) : null,
      });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      absorb(toCollectionItem(res.data));
      closeAdd();
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
        // J1 — an unreadable scrape (e.g. a Games Workshop page blocked
        // behind Cloudflare) is an honest dead-end, not a success. Drop
        // the painter into manual entry instead of creating a hostname-
        // named row and firing a green "Added" toast.
        if (res.reason === "unreadable") {
          // R2-4 — J1's toast was the ONLY account of what happened, and it
          // self-dismisses after ~2.4s having arrived seconds after the paste,
          // so it was easy to miss entirely: the dialog then just read "Add
          // paint" with no hint a link had been involved. Say it in the dialog
          // too, name the host, and show the URL so it survives even a cancel.
          const label = storeLabelForUrl(url);
          setPendingUrl(url);
          setAddError(
            `We couldn’t read that ${label ?? "page"} link, so there was nothing to fill in. Type the name and we’ll keep the link on the row: ${url}`,
          );
          setAdding(kind);
          toast("Couldn’t auto-read that link — add the details below.", "cyan");
        } else {
          setPendingUrl(null);
          toast(res.error, "red");
        }
        return;
      }
      absorb(toCollectionItem(res.data));
      toast(`Added ${res.data.title}`, "green");
    });
  }

  /** "Scan paints" — send the photo to vision + catalog matching. Nothing
   *  is persisted here; the confirm dialog's own "Add N paints" drives
   *  `confirmScan` below. */
  async function scanPhoto(
    imageBase64: string,
    mediaType: ScanImageMediaType,
  ): Promise<ScanPhotoOutcome> {
    const res = await scanPaintsFromPhoto({ imageBase64, mediaType });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, items: res.data.items };
  }

  /** Confirm dialog's "Add N paints" — splits the confirmed matches by
   *  Owned/Wishlist and persists each group through the EXISTING bulk-add
   *  path (same write `bulkAddPaintsToCollection` the Library grid uses),
   *  then absorbs the newly linked rows into local state. */
  async function confirmScan(confirmed: ConfirmedScanPaint[]): Promise<ConfirmScanOutcome> {
    const groups: { status: BulkOwnershipStatus; paintIds: string[] }[] = [
      { status: "OWNED", paintIds: confirmed.filter((c) => c.status === "OWNED").map((c) => c.paintId) },
      {
        status: "WISHLIST",
        paintIds: confirmed.filter((c) => c.status === "WISHLIST").map((c) => c.paintId),
      },
    ];
    let total = 0;
    for (const group of groups) {
      if (group.paintIds.length === 0) continue;
      const res = await bulkAddPaintsToCollection({ paintIds: group.paintIds, status: group.status });
      if (!res.ok) return { ok: false, error: res.error };
      total += res.data.count;
      for (const item of res.data.items) absorb(toCollectionItem(item));
    }
    toast(`Added ${total} paint${total === 1 ? "" : "s"} to Collection`, "green");
    return { ok: true };
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
    const name = recipes.find((r) => r.id === recipeId)?.name ?? "recipe";
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
      projects={projects}
      status={status}
      recipeSwatches={recipeSwatches}
      onAddUrl={(url, kind) => addUrl(url, kind)}
      onScanPhoto={scanPhoto}
      onConfirmScan={confirmScan}
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
      onAddPaint={() => {
        closeAdd();
        setAdding("paint");
      }}
      onAddModel={() => {
        closeAdd();
        setAdding("model");
      }}
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
      onClose={closeAdd}
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

/**
 * The collection lists arrive as PROPS from the server page, not through
 * MockProvider (Ross, 2026-08-02 — "speed up the website"). They used to ride
 * in `loadAppData`, which the signed-in layout runs on every route, so a few
 * hundred paint rows were serialized into the payload of every page and of
 * every server action's re-render — on screens that never show a collection.
 */
export interface CollectionData {
  collectionPaints: CollectionItem[];
  collectionModels: CollectionItem[];
  /** For the "assign to project" menu on a row. */
  projects: Project[];
  /** For the recipe picker a paint row can attach to. */
  recipes: Recipe[];
}

export function CollectionClient(props: CollectionData) {
  return (
    <Suspense fallback={null}>
      <CollectionRoute {...props} />
    </Suspense>
  );
}
