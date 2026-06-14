"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CollectionView, type CollectionStatus } from "@/components/collection/CollectionView";
import { useMockData } from "@/mock/MockProvider";
import type { CollectionItem, ProjectStatus } from "@/lib/types";
import {
  setWishlistStatus,
  updateWishlistItem,
  deleteWishlistItem,
} from "@/lib/actions/wishlist";

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

function CollectionRoute() {
  const data = useMockData();
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

  const patch = (item: CollectionItem, fields: Partial<CollectionItem>) => {
    const apply = (list: CollectionItem[]) =>
      list.map((x) => (x.id === item.id ? { ...x, ...fields } : x));
    if (item.kind === "paint") setPaints(apply);
    else setModels(apply);
  };

  return (
    <CollectionView
      paints={paints}
      models={models}
      projects={data.projects}
      status={status}
      onAddUrl={() => {}}
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
      onAddPaint={() => {}}
      onAddModel={() => {}}
      onRetry={() => {}}
    />
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={null}>
      <CollectionRoute />
    </Suspense>
  );
}
