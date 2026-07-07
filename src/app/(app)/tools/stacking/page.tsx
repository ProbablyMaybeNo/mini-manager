"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayeringTool } from "@/components/tools/LayeringTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { useToast } from "@/components/kit";
import { AssignToRecipeDialog } from "@/components/recipe/AssignToRecipeDialog";
import type { ToolSwatch } from "@/lib/types";

export default function LayeringPage() {
  const router = useRouter();
  const { save, dialog } = usePaletteSaver("gradient");
  const { toast, node } = useToast();
  const [assigning, setAssigning] = useState<{
    swatches: ToolSwatch[];
    mode: "create" | "assign";
  } | null>(null);

  return (
    <ToolShell
      title="COLOR STACKING"
      blurb="Build a shadow-to-highlight ramp, then stack translucent layers to see what colour they actually paint — every layer shows through the ones on top of it. Find the colours here; turn them into paints by sending them to a recipe."
    >
      <LayeringTool
        onSavePalette={save}
        onCreateRecipe={(swatches) => setAssigning({ swatches, mode: "create" })}
        onAssignRecipe={(swatches) => setAssigning({ swatches, mode: "assign" })}
      />
      <AssignToRecipeDialog
        open={assigning != null}
        swatches={assigning?.swatches ?? []}
        mode={assigning?.mode ?? "create"}
        onClose={() => setAssigning(null)}
        onAssigned={(result) =>
          result.created
            ? router.push(`/recipes/${result.recipeId}`)
            : toast(`Added to ${result.name}`, "green")
        }
      />
      {dialog}
      {node}
    </ToolShell>
  );
}
