"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/kit";
import { setRecipeLibraryVisibility } from "@/lib/actions/galleryPosts";

/**
 * "Save to my recipes" on a gallery-only post.
 *
 * A post made with "Save this to my recipe list" unticked exists nowhere in
 * the app except the gallery's Your-cards strip — that is the whole point.
 * Without this button that choice would be permanent from the UI, which
 * turns a reasonable tidiness preference into a trap the first time someone
 * unticks it and then wants the paints back. One click undoes it.
 */
export function SaveToRecipesButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await setRecipeLibraryVisibility({
        recipeId,
        saveToLibrary: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button variant="tertiary" size="sm" onClick={handleClick} disabled={isPending}>
        <BookmarkPlus size={14} aria-hidden />
        {isPending ? "Saving…" : "Save to my recipes"}
      </Button>
      {error && (
        <p role="alert" className="font-mono text-[11px] text-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
