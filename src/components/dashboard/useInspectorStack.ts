"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inspectorHref, readInspectorStack } from "@/lib/inspectorStack";

/**
 * Owns the project inspector's drill stack (MOP-004): OS/browser Back pops one
 * tier — sub-project → parent → closed — and never exits the app mid-drill.
 *
 * The stack lives in the URL and is *derived* from it, never mirrored into a
 * parallel structure. Each tier is one ordinary history entry, so Back needs no
 * handler at all: the URL changes, `useSearchParams` re-renders, the panel
 * follows. That is the whole fix for R2-17 — the previous model kept its own
 * stack in `history.state` plus a depth counter, and lost both races it was in
 * (Next's `replaceState` wiped the custom state, and the close-unwind's
 * `history.go(-n)` cancelled router pushes that were still in flight).
 *
 * Writes normally use the native History API *with a URL*, Next's supported way
 * to change search params without re-running the server. `router.push` would
 * re-run `loadAppData` on this force-dynamic route before the panel could
 * render — measured at ~512ms per open against ~332ms, plus a whole-page fetch
 * every time — which is not a cost this surface should pay on a phone.
 *
 * Closing unwinds with `history.go(-n)`, and that traversal is asynchronous in
 * two ways that both bite:
 *   - its delta is resolved when the task RUNS, so an entry pushed while it is
 *     pending shifts the target and it pops the wrong one (close the panel,
 *     immediately open another project, and the new panel is taken down a beat
 *     later);
 *   - Next re-syncs the URL from its own router state a few hundred ms after
 *     the popstate, briefly writing the pre-traversal URL back, so a native
 *     write landing in there is silently overwritten.
 * So a write issued while a traversal is outstanding is QUEUED until the
 * popstate lands, then applied through the ROUTER, whose action queue orders it
 * against the traversal Next is still reducing. That path costs one fetch, but
 * only for the close-then-immediately-reopen case, never the common one.
 *
 * `pushedRef` is the one piece of bookkeeping left: how many entries THIS mount
 * pushed, so an explicit close can unwind exactly those and leave none behind.
 * Nothing renders from it — at worst a stale count costs one history entry, it
 * can never desync the UI from the URL.
 */
type WriteMode = "tier" | "replace" | "open";

interface PendingTraversal {
  /** Stack depth once the traversal has landed — decides push vs replace. */
  settlesTo: number;
  queued: { next: string[]; mode: WriteMode } | null;
}

export interface InspectorStack {
  /** Open project ids, root first. Empty when the inspector is closed. */
  stack: string[];
  /** Show `id` as the inspector root: a new tier when closed, a swap when open. */
  open: (id: string) => void;
  /** Drill one tier down into a sub-project. */
  drill: (id: string) => void;
  /** Close the tier at `index` (and, when it is the top tier, step back). */
  closeTier: (index: number) => void;
  /** Close the whole inspector, unwinding every entry this mount pushed. */
  close: () => void;
}

export function useInspectorStack(): InspectorStack {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stack = useMemo(() => readInspectorStack(searchParams), [searchParams]);

  const pushedRef = useRef(0);
  const pendingRef = useRef<PendingTraversal | null>(null);
  // Closing traverses history, and a traversal only commits a frame or two
  // later. Waiting for that would leave the panel on screen after the painter
  // pressed ×, which is both wrong and a hazard for whatever they click next,
  // so the close is optimistic: hide it now, let the URL catch up.
  const [closing, setClosing] = useState(false);

  // Reads the LIVE url, not the render's snapshot: writes can be applied from a
  // popstate handler, where the React values are a frame behind.
  const liveStack = () => readInspectorStack(new URL(window.location.href).searchParams);

  /**
   * Write `next` as the drill stack.
   *   "tier"    — a new tier: one new history entry, so Back pops just it.
   *   "replace" — same depth, different content: no new entry.
   *   "open"    — a tier when the panel is closed, a replace when it is already
   *               open, so switching projects never costs a Back press.
   */
  const applyWrite = useCallback(
    (next: readonly string[], mode: WriteMode, depth: number, viaRouter: boolean) => {
      const url = new URL(window.location.href);
      const href = inspectorHref(url.pathname, url.searchParams, next);
      // Already there — skip. A router call would still be a real navigation,
      // and the open-on-create effect re-runs on every render until its
      // one-shot id is consumed, so an unguarded write would re-navigate the
      // page under the painter's cursor.
      if (href === `${url.pathname}${url.search}`) return;
      const push = mode === "tier" || (mode === "open" && depth === 0);
      if (push) pushedRef.current += 1;
      if (viaRouter) {
        if (push) router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      } else if (push) {
        window.history.pushState(null, "", href);
      } else {
        window.history.replaceState(null, "", href);
      }
    },
    [router],
  );

  /** Apply now, or hold until the traversal we issued has landed. */
  const write = useCallback(
    (next: readonly string[], mode: WriteMode) => {
      const pending = pendingRef.current;
      if (pending) {
        pending.queued = { next: [...next], mode };
        return;
      }
      applyWrite(next, mode, liveStack().length, false);
    },
    [applyWrite],
  );

  const traverse = useCallback((delta: number, settlesTo: number) => {
    pendingRef.current = { settlesTo, queued: null };
    window.history.go(delta);
  }, []);

  // Every Back/Forward consumes one of the entries we pushed. Nothing here
  // touches the UI — the URL already did that.
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = Math.max(0, pushedRef.current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Release a queued write once the traversal has actually COMMITTED — that is,
  // once the router's own view of the URL (this `stack`) has caught up, not
  // merely when popstate fired. Next commits the traversal a beat after the
  // event, writing the pre-traversal URL back as it does; a write released at
  // popstate lands before that and the panel visibly closes and reopens.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || stack.length !== pending.settlesTo) return;
    pendingRef.current = null;
    const queued = pending.queued;
    if (queued) applyWrite(queued.next, queued.mode, pending.settlesTo, true);
  }, [stack, applyWrite]);

  const open = useCallback((id: string) => write([id], "open"), [write]);

  const drill = useCallback(
    (id: string) => {
      const current = liveStack();
      if (current.length === 0 || current.includes(id)) return;
      write([...current, id], "tier");
    },
    [write],
  );

  const close = useCallback(() => {
    if (pendingRef.current) return; // already unwinding
    const depth = pushedRef.current;
    if (depth > 0) {
      setClosing(true);
      // Unwind our own entries so the session history is exactly where it was
      // before the inspector opened.
      pushedRef.current = 0;
      traverse(-depth, 0);
      return;
    }
    // Nothing of ours to unwind (deep link / reload with the panel already
    // open) — drop the params in place rather than leaving the page.
    write([], "replace");
  }, [traverse, write]);

  const closeTier = useCallback(
    (index: number) => {
      if (pendingRef.current) return;
      const current = liveStack();
      if (index <= 0 || index >= current.length) return;
      if (index === current.length - 1 && pushedRef.current > 0) {
        // The top tier is exactly one Back — let the browser do it so the
        // entry is consumed rather than stranded.
        traverse(-1, current.length - 1);
        return;
      }
      write(
        current.filter((_, i) => i !== index),
        "replace",
      );
    },
    [traverse, write],
  );

  // Drop the optimistic close once the URL agrees (or something else reopened
  // the panel in the meantime — then the URL wins again).
  useEffect(() => {
    if (closing && pendingRef.current === null) setClosing(false);
  }, [closing, stack]);

  return { stack: closing ? EMPTY_STACK : stack, open, drill, closeTier, close };
}

const EMPTY_STACK: string[] = [];
