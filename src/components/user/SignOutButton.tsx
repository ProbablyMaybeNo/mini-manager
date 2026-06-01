"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/app/user/actions";

/**
 * Pill-shaped sign-out button rendered in the /user page footer.
 * Wraps the signOutAction server action in a transition so the
 * button reflects pending state if the network blip slows the
 * redirect. UX-V6-003.
 */
export function SignOutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      size="md"
      disabled={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
