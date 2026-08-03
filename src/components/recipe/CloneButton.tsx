"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/kit";
import { guarded } from "@/lib/actionGuard";
import { cloneRecipeFromSlug } from "@/lib/actions/recipeSharing";

/**
 * Recipe-card phase 3 — "Clone to my library" on `/r/[slug]` and the
 * `/gallery` cards. Free (no Pro gate), matching the rest of the sharing
 * surface.
 *
 * `isSignedIn` is resolved server-side (the caller reads `auth()` in a
 * server component and passes the boolean down) rather than checked here:
 * `cloneRecipeFromSlug` calls `currentUserId()`, which redirects an
 * anonymous caller to `/sign-in` — but the brief wants a logged-out click
 * to land on `/sign-up?from=/r/<slug>` instead, so the signed-out case is
 * a plain `<Link>` and never invokes the action at all.
 */
export function CloneButton({
  slug,
  isSignedIn,
  size = "md",
  variant = "outlineCyan",
}: {
  slug: string;
  isSignedIn: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <Link
        href={`/sign-up?from=/r/${slug}`}
        className="inline-flex items-center gap-2 rounded-[6px] border border-cyan/60 bg-transparent px-4 py-2.5 font-display font-bold uppercase text-button tracking-tight text-cyan-lite transition-colors hover:bg-cyan/10 hover:border-cyan"
      >
        <Copy size={16} aria-hidden />
        Clone to my library
      </Link>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      // R2-14 — this button sits on every `/r/<slug>` and every `/gallery`
      // card, so it is the highest-value click in the funnel: a stranger
      // arriving from a shared link. Unguarded, a flaky connection answered
      // that click with the whole-app fault screen. Now it says "try again"
      // and the recipe they came to see is still on screen behind it.
      const res = await guarded(
        () => cloneRecipeFromSlug({ slug }),
        "Couldn’t clone that recipe — check your connection, then try again.",
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/recipes/${res.data.id}`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={handleClick} disabled={isPending}>
        <Copy size={16} aria-hidden />
        {isPending ? "Cloning…" : "Clone to my library"}
      </Button>
      {error && <p className="font-mono text-[11px] text-red-text">▸ {error}</p>}
    </div>
  );
}
