"use client";

/**
 * LIB-COLORMAP — shared optimistic inventory store for the library page.
 *
 * The CollectionPanel (right-hand colour map) draws live owned/wishlist
 * dots, and the per-row InventoryControls let the painter toggle those
 * states from the list. To keep the map dots in sync with a row's
 * optimistic toggle WITHOUT a server round-trip, both write into this
 * tiny context: a Map<paintId, snapshot> held in provider state.
 *
 * The consumer hook is OPTIONAL — `useInventoryOverrides()` returns null
 * when no provider is mounted, so InventoryControls stays safe on any
 * page (detail panel, recipe surfaces, etc.) that doesn't wrap it.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface InventoryOverrideSnapshot {
  ownedCount: number;
  isWishlisted: boolean;
}

export interface InventoryOverridesValue {
  /** The optimistic snapshot for a paint, or undefined when untouched. */
  get(paintId: string): InventoryOverrideSnapshot | undefined;
  /** Mirror a row's optimistic snapshot into the shared store. */
  set(paintId: string, snap: InventoryOverrideSnapshot): void;
}

const InventoryOverridesContext = createContext<InventoryOverridesValue | null>(
  null,
);

/**
 * Optional consumer. Returns null when no provider is mounted so callers
 * (e.g. InventoryControls on a page without the colour map) degrade to a
 * no-op rather than crashing.
 */
export function useInventoryOverrides(): InventoryOverridesValue | null {
  return useContext(InventoryOverridesContext);
}

export function InventoryOverridesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // A version counter forces re-render of consumers (CollectionPanel) when
  // the mutable Map mutates — the Map identity itself stays stable so we
  // don't churn allocations on every toggle.
  const [store] = useState(() => new Map<string, InventoryOverrideSnapshot>());
  const [, setVersion] = useState(0);

  const get = useCallback(
    (paintId: string) => store.get(paintId),
    [store],
  );

  const set = useCallback(
    (paintId: string, snap: InventoryOverrideSnapshot) => {
      store.set(paintId, snap);
      setVersion((v) => v + 1);
    },
    [store],
  );

  const value = useMemo<InventoryOverridesValue>(
    () => ({ get, set }),
    [get, set],
  );

  return (
    <InventoryOverridesContext.Provider value={value}>
      {children}
    </InventoryOverridesContext.Provider>
  );
}
