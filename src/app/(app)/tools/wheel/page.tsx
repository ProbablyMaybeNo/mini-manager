"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ColourWheelTool } from "@/components/tools/ColourWheelTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { useToast } from "@/components/kit";
import { AssignToRecipeDialog, type AssignSwatch } from "@/components/recipe/AssignToRecipeDialog";
import { closestPaint, rankMatches } from "@/lib/toolMatch";
import type { Paint } from "@/lib/types";
import { useCatalog } from "../useCatalog";

/** Resolve a free-text paint title → hex over the kit catalog (exact name,
 *  then "Brand Name" exact, then name substring). Mirrors the wheel tool's
 *  `?name=` deep-link fallback. */
function resolveHexByName(paints: Paint[], rawTitle: string): string | null {
  const q = rawTitle.trim().toLowerCase();
  if (!q) return null;
  const hit =
    paints.find((p) => p.name.toLowerCase() === q) ??
    paints.find((p) => `${p.brand} ${p.name}`.toLowerCase() === q) ??
    paints.find((p) => p.name.toLowerCase().includes(q));
  return hit?.hex ?? null;
}

function ColourWheelRoute() {
  const paints = useCatalog();
  const router = useRouter();
  const params = useSearchParams();
  const { save, dialog } = usePaletteSaver("wheel");
  const { toast, node } = useToast();
  const [assigning, setAssigning] = useState<AssignSwatch[] | null>(null);

  // MM-53 — `?hex` (canonical) and `?name` (catalog-resolved fallback) seed
  // the primary pick. Both read once; mid-session URL edits don't re-seed.
  const seedHex = useMemo(() => {
    const hex = params.get("hex");
    if (hex && /^#?[0-9a-fA-F]{6}$/.test(hex)) return hex.startsWith("#") ? hex : `#${hex}`;
    const name = params.get("name");
    if (name && paints.length) return resolveHexByName(paints, name);
    return null;
  }, [params, paints]);

  return (
    <ToolShell
      title="COLOR WHEEL"
      blurb="Test colour harmonies to find the perfect scheme. Spin the wheel and switch harmony to see complementary, triadic, and analogous combos — then match each pick to real paints, save the palette, or send it straight to a recipe."
    >
      <ColourWheelTool
        seedHex={seedHex}
        closestPaint={(hex) => closestPaint(hex, paints)}
        // DOP-013 — ranked alternatives feed the "more matches" disclosure.
        rankPaints={(hex, n) => rankMatches(hex, paints, undefined, n).map((m) => m.paint)}
        onSavePalette={save}
        // CIzKX — the whole scheme's colours (every slot, matched paint or
        // not) go into the create-or-assign chooser instead of discarding
        // them on a bare navigate.
        onSendToRecipe={(swatches) => setAssigning([...swatches])}
        // Per-swatch "assign paint" → assign that planned colour into a recipe.
        onAssignPaint={(hex) => {
          const p = closestPaint(hex, paints);
          setAssigning([{ hex, paintId: p?.id ?? null, name: p?.name }]);
        }}
      />
      <AssignToRecipeDialog
        open={assigning != null}
        swatches={assigning ?? []}
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

export default function ColourWheelPage() {
  return (
    <Suspense fallback={null}>
      <ColourWheelRoute />
    </Suspense>
  );
}
