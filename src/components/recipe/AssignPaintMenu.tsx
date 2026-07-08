"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, useToast, type ButtonProps } from "@/components/kit";
import { cn } from "@/lib/cn";
import { addPaintToOwned, addPaintToWishlist } from "@/lib/actions/inventory";
import type { ToolSwatch } from "@/lib/types";
import {
  AssignToRecipeDialog,
  type AssignDialogMode,
  type AssignedResult,
} from "./AssignToRecipeDialog";

export type { AssignedResult };

/**
 * The shared ASSIGN control for a single paint swatch — every colour tool's
 * per-paint "Assign" button funnels through this one primitive. A click opens
 * a small menu instead of jumping straight to the recipe dialog:
 *
 *  1. Add to existing recipe   — opens {@link AssignToRecipeDialog} (mode "assign")
 *  2. Create new recipe        — opens {@link AssignToRecipeDialog} (mode "create")
 *  3. Add to Wishlist          — inventory write, only when `swatch.paintId` is real
 *  4. Add to Owned             — inventory write, only when `swatch.paintId` is real
 *
 * Options 3/4 need a real catalog paint to attach inventory to, so they're
 * hidden for a raw-hex swatch with no `paintId` (a palette send, a ramp step,
 * an eyedropper pixel) — those colours only ever get the two recipe options.
 *
 * Self-contained: owns its own open state, its own recipe dialog, and its own
 * toast for the Wishlist/Owned outcomes. Recipe outcomes bubble up via
 * `onAssigned` so the host page can navigate to a freshly-created recipe or
 * toast an append — identical contract to {@link AssignToRecipeDialog}.
 */
export function AssignPaintMenu({
  swatch,
  onAssigned,
  buttonVariant,
  buttonSize = "sm",
  buttonClassName,
  disabled = false,
}: {
  swatch: ToolSwatch;
  /** Recipe outcome pass-through (append vs. create-and-navigate). Not
   *  called for Wishlist/Owned — those toast locally. */
  onAssigned?: (result: AssignedResult) => void;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  buttonClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<AssignDialogMode | null>(null);
  const [pending, setPending] = useState<"owned" | "wishlist" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { toast, node } = useToast();
  const hasPaint = Boolean(swatch.paintId);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openRecipeDialog(mode: AssignDialogMode) {
    setOpen(false);
    setDialogMode(mode);
  }

  async function handleAddToOwned() {
    if (!swatch.paintId || pending) return;
    setOpen(false);
    setPending("owned");
    const res = await addPaintToOwned({ paintId: swatch.paintId });
    setPending(null);
    if (!res.ok) {
      toast(res.error, "red");
      return;
    }
    toast(res.data.already ? "Already owned" : "Marked as owned", "green");
  }

  async function handleAddToWishlist() {
    if (!swatch.paintId || pending) return;
    setOpen(false);
    setPending("wishlist");
    const res = await addPaintToWishlist({ paintId: swatch.paintId });
    setPending(null);
    if (!res.ok) {
      toast(res.error, "red");
      return;
    }
    toast(res.data.already ? "Already on your wishlist" : "Added to wishlist", "green");
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <Button
        type="button"
        size={buttonSize}
        variant={buttonVariant}
        disabled={disabled || pending != null}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        Assign
      </Button>

      {open && (
        <ul
          role="menu"
          aria-label="Assign paint"
          className="absolute right-0 top-full z-30 mt-1 min-w-[200px] border border-dotted border-purple/60 bg-bg py-1 panel-depth motion-safe:animate-menu-in"
        >
          <MenuItem onClick={() => openRecipeDialog("assign")}>Add to existing recipe</MenuItem>
          <MenuItem onClick={() => openRecipeDialog("create")}>Create new recipe</MenuItem>
          {hasPaint && (
            <>
              <MenuItem onClick={() => void handleAddToWishlist()}>Add to Wishlist</MenuItem>
              <MenuItem onClick={() => void handleAddToOwned()}>Add to Owned</MenuItem>
            </>
          )}
        </ul>
      )}

      <AssignToRecipeDialog
        open={dialogMode != null}
        swatches={[swatch]}
        mode={dialogMode ?? "both"}
        onClose={() => setDialogMode(null)}
        onAssigned={(result) => {
          setDialogMode(null);
          onAssigned?.(result);
        }}
      />
      {node}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
          "block min-h-11 w-full px-3 py-2 text-left font-body text-body text-fg transition-colors",
          "hover:bg-purple/10 hover:text-purple md:min-h-0",
        )}
      >
        {children}
      </button>
    </li>
  );
}
