"use client";

import { useRef } from "react";
import { ShareModal } from "@/components/recipes/ShareModal";
import type { MarkdownInput } from "@/lib/recipes/markdown";
import { Button } from "@/components/ui/Button";

interface Props {
  recipeId: string;
  recipeName: string;
  initialPublicSlug: string | null;
  markdownInput: MarkdownInput;
  jsonPayload: unknown;
}

/**
 * Share trigger in the recipe header. Owns the ref to the
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
      <Button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        variant="secondary"
        size="sm"
        title="Share recipe"
        aria-label="Share recipe"
      >
        Share recipe
      </Button>
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
