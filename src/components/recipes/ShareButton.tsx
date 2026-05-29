"use client";

import { useRef } from "react";
import { ShareModal } from "@/components/recipes/ShareModal";
import type { MarkdownInput } from "@/lib/recipes/markdown";

interface Props {
  recipeId: string;
  recipeName: string;
  initialPublicSlug: string | null;
  markdownInput: MarkdownInput;
  jsonPayload: unknown;
}

/**
 * Small `[ share ]` trigger in the recipe header. Owns the ref to the
 * <ShareModal>'s dialog so the modal itself stays state-driven.
 */
export function ShareButton({
  recipeId,
  recipeName,
  initialPublicSlug,
  markdownInput,
  jsonPayload,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-2xs font-mono uppercase tracking-wider tap-target text-[var(--color-fg-subtle)] hover:text-[var(--color-green)]"
        title="Share recipe"
      >
        [ share ]
      </button>
      <ShareModal
        dialogRef={dialogRef}
        recipeId={recipeId}
        recipeName={recipeName}
        initialPublicSlug={initialPublicSlug}
        markdownInput={markdownInput}
        jsonPayload={jsonPayload}
      />
    </>
  );
}
