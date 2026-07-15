"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, ModalDialog } from "@/components/kit";

/**
 * Signed-out "sign in to save" cue for the colour tools.
 *
 * `/tools/*` render 200 for signed-out visitors (the most search-
 * discoverable surface), but Save / Send-to-Recipe hit server actions
 * whose `currentUserId()` silently redirects to `/sign-in`, discarding the
 * generated palette + typed name. This dialog replaces that dead-end: it
 * never navigates on its own, so the in-progress palette on the tool is
 * preserved. The painter chooses whether to sign in — the link carries a
 * `?from=` return path back to this exact tool.
 */
export function SignInToSaveDialog({
  open,
  onClose,
  what = "your palette",
}: {
  open: boolean;
  onClose: () => void;
  /** What the painter is trying to keep, e.g. "your palette" / "these colours". */
  what?: string;
}) {
  const pathname = usePathname();
  const from = pathname ? `?from=${encodeURIComponent(pathname)}` : "";
  return (
    <ModalDialog open={open} onClose={onClose} title="Sign in to save" breadcrumb="TOOLS">
      <p className="font-body text-body text-fg">
        Sign in to save {what}. Your work stays right here — nothing’s lost.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/sign-in${from}`}>
          <Button size="sm">Sign in</Button>
        </Link>
        <Link href={`/sign-up${from}`}>
          <Button size="sm" variant="secondary">
            Create account
          </Button>
        </Link>
        <Button size="sm" variant="tertiary" onClick={onClose}>
          Keep editing
        </Button>
      </div>
    </ModalDialog>
  );
}
