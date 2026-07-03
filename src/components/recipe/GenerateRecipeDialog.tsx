"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ModalDialog, Swatch, useToast } from "@/components/kit";
import { cn } from "@/lib/cn";
import { generateRecipeFromColors } from "@/lib/actions/generateRecipeFromColors";
import {
  buildLayerRamp,
  groundRampToCatalog,
  scoreHarmony,
} from "@/lib/recipes/generate";
import { getHarmonyMeta } from "@/lib/tools/wheel/harmonies";
import type { MatchConfidence } from "@/lib/tools/match/find";
import type { Paint } from "@/lib/types";

/** Confidence → dot colour beside a grounded paint. */
const CONFIDENCE_DOT: Record<MatchConfidence, string> = {
  high: "bg-green",
  medium: "bg-yellow",
  low: "bg-fg-faint",
};

const ROLE_LABEL: Record<string, string> = {
  shade: "Shade",
  base: "Base",
  layer: "Layer",
  highlight: "Highlight",
  edge: "Edge",
};

/**
 * Preview + save a colour-first recipe. Given the colours the painter picked on
 * the wheel, it shows the tinted layer ramp per colour grounded to real catalog
 * paints (client-side, using the same pure engine the server action re-runs on
 * save), plus the harmony read-out. "Save recipe" calls the deterministic
 * `generateRecipeFromColors` action and navigates to the new recipe.
 */
export function GenerateRecipeDialog({
  open,
  hexes,
  catalog,
  onClose,
}: {
  open: boolean;
  hexes: string[];
  catalog: Paint[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [pending, start] = useTransition();

  const { grounded, score, customCount } = useMemo(() => {
    const ramps = hexes.map((h) => buildLayerRamp(h)).filter((r) => r !== null);
    const g = groundRampToCatalog(ramps, catalog);
    const custom = g.reduce(
      (n, color) =>
        n +
        color.steps.filter(
          (s) => s.paint === null || s.confidence === "low",
        ).length,
      0,
    );
    return { grounded: g, score: scoreHarmony(hexes), customCount: custom };
  }, [hexes, catalog]);

  const schemeLabel = score.harmony ? getHarmonyMeta(score.harmony).label : "Custom";

  function save() {
    start(async () => {
      const res = await generateRecipeFromColors({ hexes });
      if (res.ok) {
        router.push(`/recipes/${res.data.id}`);
      } else {
        toast(res.error, "red");
      }
    });
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Generate recipe from colours"
      breadcrumb="COLOR WHEEL"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {/* Scheme read-out + any clash warnings. */}
        <div className="flex flex-col gap-1">
          <p className="font-body text-body text-fg">
            <span className="font-bold">{schemeLabel} scheme</span>{" "}
            <span className="text-fg-faint">
              · {Math.round(score.cohesion * 100)}% cohesion
            </span>
          </p>
          {score.clashes.map((c, i) => (
            <p key={i} className="label-osd text-yellow">
              ⚠ {hexes[c.a]} ↔ {hexes[c.b]}: {c.reason}
            </p>
          ))}
        </div>

        {/* One ramp block per picked colour. */}
        {grounded.map((color, ci) => (
          <div key={ci} className="flex flex-col gap-2 border border-cyan/20 p-3">
            <div className="flex items-center gap-2">
              <Swatch hex={color.source} size="md" />
              <span className="font-body text-body font-bold text-fg">{color.source}</span>
            </div>
            {/* One row per ramp step (shade → edge, top to bottom). A row list
                reads cleanly at any width — the old 5-column grid collided its
                paint labels into an unreadable smear at ≤440px (UX-001/MUX-001). */}
            <ul className="flex flex-col gap-1.5">
              {color.steps.map((step) => (
                <li key={step.role} className="flex items-center gap-2.5">
                  <Swatch hex={step.hex} size="md" />
                  <span className="w-20 shrink-0 whitespace-nowrap label-osd text-fg-faint">
                    {ROLE_LABEL[step.role]}
                  </span>
                  {step.paint ? (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-2 w-2 shrink-0 rounded-full",
                          CONFIDENCE_DOT[step.confidence ?? "low"],
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-body text-body text-fg">
                          {step.confidence !== "low" ? step.paint.name : "Custom mix"}
                        </span>
                        <span className="truncate label-osd text-fg-faint">
                          {step.confidence !== "low"
                            ? step.paint.brand
                            : `nearest: ${step.paint.name}`}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-body text-body text-fg-faint">
                      Custom mix — no catalog match
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {customCount > 0 && (
          <p className="label-osd text-fg-faint">
            {customCount} step{customCount === 1 ? "" : "s"} use a custom mix — no close
            catalog match. You can swap in your nearest bottle after saving.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-cyan/10 pt-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="add" size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save recipe"}
          </Button>
        </div>
      </div>
      {node}
    </ModalDialog>
  );
}
