"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { createRecipe } from "@/lib/actions/recipes";

interface Props {
  defaultName?: string;
  attachedProjectId?: string;
  attachedNamedModelId?: string;
  variant?: "primary" | "subtle";
  label?: string;
}

/**
 * Single button that creates an empty recipe via the server action and
 * navigates straight to its editor. Used on /recipes and inside the
 * AttachRecipeModal "Create new" tab (P3.6).
 */
export function NewRecipeButton({
  defaultName = "Untitled recipe",
  attachedProjectId,
  attachedNamedModelId,
  variant = "primary",
  label = "[ + ] New recipe",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createRecipe({
        name: defaultName,
        bodyType: "infantry",
        attachedProjectId: attachedProjectId ?? null,
        attachedNamedModelId: attachedNamedModelId ?? null,
      });
      if (result.ok) {
        router.push(`/recipes/${result.data.id}`);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={clsx(
        "inline-flex items-center gap-2 px-4 py-2 tap-target text-sm font-mono",
        variant === "primary"
          ? "frame-strong hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]",
        isPending && "opacity-60 cursor-progress",
      )}
    >
      {isPending ? "[ … ] Creating" : label}
    </button>
  );
}
