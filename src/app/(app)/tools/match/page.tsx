"use client";

import { useMemo, useState } from "react";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useToast } from "@/components/kit";
import { AssignToRecipeDialog, type AssignSwatch } from "@/components/recipe/AssignToRecipeDialog";
import { rankMatchesMulti } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function ColourMatchPage() {
  const paints = useCatalog();
  const { toast, node } = useToast();
  const [assigning, setAssigning] = useState<AssignSwatch | null>(null);
  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  return (
    <ToolShell
      title="COLOR MATCH"
      blurb="Enter or pick any colour to find the nearest paints across every brand you own and wishlist. Compare ranked matches side by side, then save the best as a palette or send it to a recipe."
    >
      <ColourMatchTool
        rankMatches={(hex, brands, limit) => rankMatchesMulti(hex, paints, brands, limit)}
        brandOptions={brandOptions}
        onUse={(paint) => {
          void navigator.clipboard?.writeText(paint.hex);
          toast(`Copied ${paint.name} · ${paint.hex}`, "green");
        }}
        // MM-33 — ASSIGN opens a dropdown of all recipes to add the paint into,
        // in place, instead of navigating to the recipes page.
        onAssign={(paint) =>
          setAssigning({ hex: paint.hex, paintId: paint.id, name: paint.name })
        }
      />
      <AssignToRecipeDialog
        open={assigning != null}
        swatches={assigning ? [assigning] : []}
        onClose={() => setAssigning(null)}
        onAssigned={(recipeName) => toast(`Added to ${recipeName}`, "green")}
      />
      {node}
    </ToolShell>
  );
}
