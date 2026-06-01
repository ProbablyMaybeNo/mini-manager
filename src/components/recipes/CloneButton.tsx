"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";

interface Props {
  slug: string;
}

/**
 * Client component — posts to `/r/[slug]/clone` and routes the visitor to
 * the new recipe on success. On 401, redirects to sign-in with the slug
 * stashed in `?from=` so the public view auto-completes the clone after
 * the magic-link click (see `/sign-in` + the `?clone=1` flag).
 */
export function CloneButton({ slug }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/r/${encodeURIComponent(slug)}/clone`, {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        if (res.status === 401) {
          const target = `/r/${slug}?clone=1`;
          router.push(
            `/sign-in?from=${encodeURIComponent(target)}&clone=1`,
          );
          return;
        }
        const body = (await res.json()) as
          | { ok: true; data: { id: string } }
          | { ok: false; error: string };
        if (!body.ok) {
          if (res.status === 409) {
            // "Already yours" — show the message + a link to the existing
            // recipe if the API surfaced an id.
            setError(body.error);
            return;
          }
          setError(body.error);
          return;
        }
        router.push(`/recipes/${body.data.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clone");
      }
    });
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        variant="success"
        size="md"
        className="w-full sm:w-auto"
      >
        {isPending ? "Cloning…" : "Clone to my recipes"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 font-mono text-xs text-[var(--color-amber)]"
        >
          <LogTag variant="warn" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Mounted on `/r/[slug]` when the URL carries `?clone=1` and the visitor
 * already has a session. Auto-triggers the clone on mount so the magic-
 * link flow lands the user on the cloned recipe with no extra click.
 *
 * The `firedRef` guards against React strict-mode double-invocation in
 * dev — without it, the POST would fire twice and create two clones.
 */
export function AutoCloneOnMount({ slug }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void (async () => {
      try {
        const res = await fetch(`/r/${encodeURIComponent(slug)}/clone`, {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        if (res.status === 401) {
          const target = `/r/${slug}?clone=1`;
          router.push(
            `/sign-in?from=${encodeURIComponent(target)}&clone=1`,
          );
          return;
        }
        const body = (await res.json()) as
          | { ok: true; data: { id: string } }
          | { ok: false; error: string };
        if (body.ok) {
          router.push(`/recipes/${body.data.id}`);
        } else {
          setError(body.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clone");
      }
    })();
  }, [router, slug]);

  return error ? (
    <p
      role="alert"
      className="max-w-md mx-auto mt-4 inline-flex items-start gap-2 font-mono text-xs text-[var(--color-amber)]"
    >
      <LogTag variant="warn" />
      <span>{error}</span>
    </p>
  ) : (
    <p
      role="status"
      className="max-w-md mx-auto mt-4 font-mono text-xs text-[var(--color-fg-muted)] text-center"
    >
      Cloning to your library…
    </p>
  );
}
