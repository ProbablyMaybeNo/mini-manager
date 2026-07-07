"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyedropperTool } from "@/components/tools/EyedropperTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { useToast } from "@/components/kit";
import { AssignToRecipeDialog } from "@/components/recipe/AssignToRecipeDialog";
import type { ToolSwatch } from "@/lib/types";

export default function EyedropperPage() {
  const router = useRouter();
  const { save, dialog } = usePaletteSaver("eyedropper");
  const { toast, node } = useToast();
  const [assigning, setAssigning] = useState<{
    swatches: ToolSwatch[];
    mode: "create" | "assign" | "both";
  } | null>(null);

  return (
    <ToolShell
      title="COLOR DROPPER"
      blurb="Drop a reference photo and eyedrop any pixel to pull its exact colour. This tool finds colours, not paints — turn a swatch into a real paint by sending it (or the whole palette) to a recipe."
    >
      <EyedropperTool
        onSavePalette={save}
        onCreateRecipe={(swatches) => setAssigning({ swatches, mode: "create" })}
        onAssignRecipe={(swatches) => setAssigning({ swatches, mode: "assign" })}
        onAssignSwatch={(swatch) => setAssigning({ swatches: [swatch], mode: "both" })}
      />
      <AssignToRecipeDialog
        open={assigning != null}
        swatches={assigning?.swatches ?? []}
        mode={assigning?.mode ?? "both"}
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
