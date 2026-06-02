"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Props {
  slotId: string;
  isActive: boolean;
  /** Search-param key the active slot is persisted to. Default
   *  `focusSlot`. */
  slotParamKey?: string;
}

/**
 * P15.0 — "Set as the active slot" affordance.
 *
 * Writes `?focusSlot=<slotId>` into the URL via `router.replace` so the
 * active slot survives reload + back/forward, mirroring the recipe-tab
 * persistence pattern. The server reads the param and re-renders the
 * FocusPanel with that slot highlighted as "▶ WORKING ON".
 *
 * The currently-active slot renders no button (it's already active) —
 * the panel shows its "▶ WORKING ON" label instead.
 */
export function SlotActivator({
  slotId,
  isActive,
  slotParamKey = "focusSlot",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (isActive) {
    return (
      <span
        className="font-mono text-2xs uppercase tracking-wider text-[var(--color-green)] shrink-0"
        data-active-slot-label
      >
        ▶ Working on
      </span>
    );
  }

  const activate = () => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set(slotParamKey, slotId);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  return (
    <Button
      type="button"
      variant="success"
      size="sm"
      tone="outline"
      onClick={activate}
      disabled={pending}
      data-activate-slot={slotId}
    >
      Work on this
    </Button>
  );
}
