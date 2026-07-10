"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button, EmptyState, Panel, useToast } from "@/components/kit";
import {
  approveGallerySubmission,
  rejectGallerySubmission,
} from "@/lib/actions/gallerySubmissions";
import type { PendingGallerySubmission } from "@/db/queries/gallerySubmissions";

/**
 * Recipe-card phase 3 — Ross's control surface. A flat list of pending
 * submissions; APPROVE / REJECT act optimistically (the row drops from the
 * list immediately) and report failure via toast + row restore.
 */
export function AdminGalleryReview({
  initialSubmissions,
}: {
  initialSubmissions: ReadonlyArray<PendingGallerySubmission>;
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const { toast, node } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function act(recipeId: string, kind: "approve" | "reject") {
    setPendingId(recipeId);
    const removed = submissions.find((s) => s.recipeId === recipeId) ?? null;
    setSubmissions((prev) => prev.filter((s) => s.recipeId !== recipeId));
    startTransition(async () => {
      const res =
        kind === "approve"
          ? await approveGallerySubmission({ recipeId })
          : await rejectGallerySubmission({ recipeId });
      setPendingId(null);
      if (!res.ok) {
        toast(res.error, "red");
        if (removed) {
          setSubmissions((prev) =>
            prev.some((s) => s.recipeId === recipeId) ? prev : [...prev, removed],
          );
        }
        return;
      }
      toast(kind === "approve" ? "Approved — now live on /gallery" : "Rejected", "green");
    });
  }

  if (submissions.length === 0) {
    return (
      <>
        <Panel label="REVIEW QUEUE" cornerTicks className="p-4">
          <EmptyState glyph="▦" title="Nothing pending" hint="Submissions will show up here." />
        </Panel>
        {node}
      </>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {submissions.map((s) => (
          <li key={s.recipeId}>
            <Panel cornerTicks className="flex h-full flex-col gap-3 p-4">
              <div className="aspect-square overflow-hidden rounded-[6px] border border-border bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.cardImageUrl}
                  alt={`${s.recipeName} — submitted card`}
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="font-h1 text-h1 text-cyan-lite">{s.recipeName}</h2>
              <p className="font-body text-body text-fg-dim">
                by {s.submitterUsername ?? s.submitterEmail ?? s.submitterId}
              </p>
              <div className="mt-auto flex gap-2">
                <Button
                  variant="solidGreen"
                  size="sm"
                  disabled={pendingId === s.recipeId}
                  onClick={() => act(s.recipeId, "approve")}
                >
                  <Check size={14} aria-hidden />
                  Approve
                </Button>
                <Button
                  variant="outlineRed"
                  size="sm"
                  disabled={pendingId === s.recipeId}
                  onClick={() => act(s.recipeId, "reject")}
                >
                  <X size={14} aria-hidden />
                  Reject
                </Button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
      {node}
    </>
  );
}
