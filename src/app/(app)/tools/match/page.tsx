"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useToast } from "@/components/kit";
import { copyText } from "@/lib/clipboard";
import { rankMatchesMulti } from "@/lib/toolMatch";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { useCatalog } from "../useCatalog";

export default function ColourMatchPage() {
  const paints = useCatalog();
  const router = useRouter();
  const { toast, node } = useToast();
  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.type))).sort(),
    [paints],
  );
  return (
    <ToolShell
      title="COLOR MATCH"
      blurb="Enter or pick any colour to find the nearest paints across every brand you own and wishlist. Compare ranked matches side by side, then save the best as a palette or send it to a recipe."
    >
      <ColourMatchTool
        rankMatches={(hex, brands, types, limit) =>
          rankMatchesMulti(hex, paints, brands, limit, { types })
        }
        brandOptions={brandOptions}
        typeOptions={typeOptions}
        enableLibraryPick
        onUse={(paint) => {
          // R2-1 — the hex is on screen nowhere else, so a blocked write has
          // to say so AND repeat the value rather than claim "Copied".
          void copyText(paint.hex, toast, {
            copied: `Copied ${paint.name} · ${paint.hex}`,
            failed: `Couldn’t copy — ${paint.name} is ${paint.hex}`,
          });
          trackClient(AnalyticsEvent.ToolMatchCompleted, { brand: paint.brand });
        }}
        // MM-33 — ASSIGN opens the shared 4-option menu (recipe / wishlist /
        // owned) in place, instead of navigating to the recipes page.
        onRecipeAssigned={(result) =>
          result.created
            ? router.push(`/recipes/${result.recipeId}`)
            : toast(`Added to ${result.name}`, "green")
        }
      />
      {node}
    </ToolShell>
  );
}
