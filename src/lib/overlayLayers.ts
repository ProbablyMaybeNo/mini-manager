/**
 * Which first-run overlay owns the screen (R3-1).
 *
 * The app has three things that can appear unbidden over the signed-in
 * surface: the 8-step dashboard tour, the 4-step first-create project
 * walkthrough, and the PWA install banner. They were written independently
 * and none of them knew about the others, so a brand-new account's first
 * action put all three on screen at once — two of them asserting
 * `aria-modal="true"` at the same z-index. That attribute tells assistive
 * technology that everything OUTSIDE the element is inert, so two at once is
 * a contradiction: neither is unambiguously on top and a screen-reader user
 * is told the page is inert twice over.
 *
 * This is the arbiter. A coach-mark claims its layer while it wants the
 * screen; exactly one claim — the highest-priority one — is ever "top", and
 * only the top one renders (and therefore only one `aria-modal` exists). The
 * install banner asks whether ANY layer is claimed and stands down while one
 * is, then comes back.
 *
 * Priority is a fixed order, NOT claim order, so the outcome doesn't depend
 * on which component's effect happened to run first — React runs child
 * effects before parent effects, so the walkthrough (deep in the dashboard)
 * always claims before the tour (in the app layout) even though the tour must
 * win. Deliberately a plain module store rather than context: the claimants
 * live in different subtrees and one of them (the install banner) is a
 * sibling of the provider, so a context would have had to be hoisted above
 * everything to reach all three.
 */

/** The coach-mark overlays that can claim the screen. */
export type OverlayLayerId = "tour" | "project-walkthrough";

/**
 * Priority, highest first. The tour outranks the walkthrough because it is
 * the global first-run tutorial and its own final step hands off INTO project
 * creation — so "tour, then walkthrough" is the order the two were written to
 * be read in, not an arbitrary tie-break.
 */
export const OVERLAY_LAYER_PRIORITY: readonly OverlayLayerId[] = [
  "tour",
  "project-walkthrough",
];

/** Pure resolver: the highest-priority claimed layer, or null if none is. */
export function topOverlayLayer(
  claimed: Iterable<OverlayLayerId>,
): OverlayLayerId | null {
  const set = new Set(claimed);
  return OVERLAY_LAYER_PRIORITY.find((id) => set.has(id)) ?? null;
}

const claimed = new Set<OverlayLayerId>();
const listeners = new Set<() => void>();
/** Cached so `getActiveOverlayLayer` is referentially stable per state — a
 *  `useSyncExternalStore` snapshot that recomputed would loop forever. */
let active: OverlayLayerId | null = null;

function publish() {
  const next = topOverlayLayer(claimed);
  if (next === active) return;
  active = next;
  for (const listener of listeners) listener();
}

/** Claim `id` while an overlay wants the screen. Returns the release fn. */
export function claimOverlayLayer(id: OverlayLayerId): () => void {
  claimed.add(id);
  publish();
  return () => {
    claimed.delete(id);
    publish();
  };
}

export function subscribeOverlayLayers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The layer currently on top, or null when nothing is claiming the screen. */
export function getActiveOverlayLayer(): OverlayLayerId | null {
  return active;
}

/** Server snapshot — nothing is ever claimed during SSR. */
export function getServerOverlayLayer(): null {
  return null;
}

/** Test seam: drop every claim. Not used by app code. */
export function resetOverlayLayers(): void {
  claimed.clear();
  publish();
}
