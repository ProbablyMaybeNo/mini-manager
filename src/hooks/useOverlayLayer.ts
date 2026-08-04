"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  claimOverlayLayer,
  getActiveOverlayLayer,
  getServerOverlayLayer,
  subscribeOverlayLayers,
  type OverlayLayerId,
} from "@/lib/overlayLayers";

/** The coach-mark layer currently owning the screen, or null. */
export function useActiveOverlayLayer(): OverlayLayerId | null {
  return useSyncExternalStore(
    subscribeOverlayLayers,
    getActiveOverlayLayer,
    getServerOverlayLayer,
  );
}

/**
 * Claim `id` while `armed`, and report whether this layer is the one on top
 * (see `@/lib/overlayLayers` for why only one may be). A caller that gets
 * `false` must render NOTHING — not a hidden copy — so that at most one
 * `aria-modal` element exists at a time and the losing overlay's key handlers
 * and scroll listeners aren't live underneath the winner.
 */
export function useOverlayLayer(id: OverlayLayerId, armed: boolean): boolean {
  useEffect(() => {
    if (!armed) return;
    return claimOverlayLayer(id);
  }, [id, armed]);

  return useActiveOverlayLayer() === id;
}
