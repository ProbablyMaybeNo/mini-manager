"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecipe } from "@/lib/actions/recipes";
import { Button } from "@/components/ui/Button";

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
  label = "New recipe",
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
    <Button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      variant={variant === "primary" ? "primary" : "ghost"}
      size="md"
    >
      {isPending ? "Creating…" : label}
    </Button>
  );
}
