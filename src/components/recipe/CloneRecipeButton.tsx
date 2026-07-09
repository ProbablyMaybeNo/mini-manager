"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast, type ButtonProps } from "@/components/kit";
import { cloneRecipeFromSlug } from "@/lib/actions/recipeSharing";

/**
 * The clone-to-library CTA on public recipe surfaces (`/r/<slug>` and the
 * `/gallery` cards) — the second half of the browse → clone → signup moat
 * loop. Logged-in painters clone straight into their library; logged-out
 * visitors bounce to sign-up with a `from=/r/<slug>` return path (the
 * existing post-auth-redirect contract in `signUpAction`/`safePostAuthPath`)
 * so they land back on this exact card once they have an account and can
 * clone from there.
 *
 * Deliberately does its own auth branching from a server-resolved
 * `isLoggedIn` prop rather than calling the server action blind — the
 * action redirects unauthenticated callers to `/sign-in`, which would lose
 * the visitor to the wrong page instead of the signup-conversion path.
 */
export function CloneRecipeButton({
  slug,
  isLoggedIn,
  className,
  size = "md",
  variant = "primary",
}: {
  slug: string;
  isLoggedIn: boolean;
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast, node } = useToast();

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    // Cards on /gallery nest this button inside a card that's otherwise
    // just a visual container (not a wrapping <a>) — stopPropagation is
    // cheap insurance against any future click-through wiring.
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push(`/sign-up?from=${encodeURIComponent(`/r/${slug}`)}`);
      return;
    }

    startTransition(async () => {
      const res = await cloneRecipeFromSlug({ slug });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      toast("Cloned to your library", "green");
      router.push(`/recipes/${res.data.id}`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Cloning…" : "Clone to my library"}
      </Button>
      {node}
    </>
  );
}
