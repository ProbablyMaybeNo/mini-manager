"use client";

import { useEffect, useState } from "react";
import { loadKitCatalog } from "@/lib/catalogClient";
import type { Paint } from "@/lib/types";

/** Load the real paint catalog client-side for the colour tools. Returns an
 *  empty array until the catalog resolves (the tools degrade gracefully —
 *  matches simply appear once it's loaded). */
export function useCatalog(): Paint[] {
  const [paints, setPaints] = useState<Paint[]>([]);
  useEffect(() => {
    let alive = true;
    loadKitCatalog()
      .then((p) => {
        if (alive) setPaints(p);
      })
      .catch(() => {
        if (alive) setPaints([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return paints;
}
