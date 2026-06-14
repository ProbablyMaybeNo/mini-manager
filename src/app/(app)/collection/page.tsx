"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CollectionView, type CollectionStatus } from "@/components/collection/CollectionView";
import { PromptDialog, useToast } from "@/components/kit";
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
    company: i.company ?? i.army ?? i.game ?? "",
    vendor: i.vendor ?? "",
    price: i.price != null ? `$${(i.price / 100).toFixed(2)}` : "",
    status: FROM_DB_STATUS[i.status ?? "WISHLIST"] ?? "WISHLIST",
    sourceUrl: i.sourceUrl ?? "",
    projectId: i.projectId ?? undefined,
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

  function addUrl(url: string) {
    startTransition(async () => {
      const res = await scrapeAndCreateWishlistItem({ url });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      absorb(toCollectionItem(res.data));
      toast(`Added ${res.data.title}`, "green");
    });
  }

  return (
    <>
    <CollectionView
      paints={paints}
      models={models}
      projects={data.projects}
      status={status}
      onAddUrl={(url) => addUrl(url)}
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
      onAttachRecipe={() => {}}
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
