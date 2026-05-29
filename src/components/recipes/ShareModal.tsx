"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { publishRecipe, unpublishRecipe } from "@/lib/actions/recipeSharing";
import { recipeToMarkdown, type MarkdownInput } from "@/lib/recipes/markdown";
import { QrCode, qrCodeToSvg } from "@/components/recipes/QrCode";
import { isNativeShareSupported, nativeShare } from "@/lib/share/webShare";

interface Props {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  recipeId: string;
  recipeName: string;
  initialPublicSlug: string | null;
  markdownInput: MarkdownInput;
  jsonPayload: unknown;
}

function publicUrlFor(slug: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/r/${slug}`;
  }
  return `/r/${slug}`;
}

function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return Promise.resolve(false);
  }
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * The four-section share modal — URL / QR / Markdown / JSON. Mounts a
 * native `<dialog>` (project convention; no modal library). The trigger
 * lives in <ShareButton>; this component owns the section state.
 *
 * State transitions:
 *   - unpublished + [ Publish ] → mints slug → URL + QR appear inline
 *   - published   + [ Regenerate ] → unpublish then publish → new slug
 *   - published   + [ Unpublish ]  → clears slug → URL + QR removed
 */
export function ShareModal({
  dialogRef,
  recipeId,
  recipeName,
  initialPublicSlug,
  markdownInput,
  jsonPayload,
}: Props) {
  const [slug, setSlug] = useState<string | null>(initialPublicSlug);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSlug(initialPublicSlug);
  }, [initialPublicSlug, recipeId]);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const url = slug ? publicUrlFor(slug) : null;

  const markdown = useMemo(() => {
    return recipeToMarkdown({
      ...markdownInput,
      publicUrl: url ?? undefined,
    });
  }, [markdownInput, url]);

  const jsonString = useMemo(
    () => JSON.stringify(jsonPayload, null, 2),
    [jsonPayload],
  );

  const flashCopied = (key: string) => {
    setCopiedKey(key);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      const res = await publishRecipe({ recipeId });
      if (res.ok) {
        setSlug(res.data.slug);
      } else {
        setError(res.error);
      }
    });
  };

  const handleUnpublish = () => {
    setError(null);
    startTransition(async () => {
      const res = await unpublishRecipe({ recipeId });
      if (res.ok) {
        setSlug(null);
      } else {
        setError(res.error);
      }
    });
  };

  const handleRegenerate = () => {
    setError(null);
    startTransition(async () => {
      const cleared = await unpublishRecipe({ recipeId });
      if (!cleared.ok) {
        setError(cleared.error);
        return;
      }
      const published = await publishRecipe({ recipeId });
      if (published.ok) {
        setSlug(published.data.slug);
      } else {
        setError(published.error);
      }
    });
  };

  const handleClose = () => dialogRef.current?.close();

  const onCopy = async (key: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) flashCopied(key);
    else setError("Copy failed. Select and copy manually.");
  };

  const onDownloadQr = async () => {
    if (!url) return;
    const svg = await qrCodeToSvg(url);
    downloadBlob(
      `mini-manager-qr-${slug}.svg`,
      svg,
      "image/svg+xml",
    );
  };

  const onDownloadJson = () => {
    downloadBlob(
      `${recipeName.replace(/[^a-z0-9_-]+/gi, "_")}.json`,
      jsonString,
      "application/json",
    );
  };

  const onNativeShare = async () => {
    if (!url) return;
    setError(null);
    const ok = await nativeShare({
      title: recipeName,
      text: `Paint recipe — ${recipeName}`,
      url,
    });
    if (!ok) {
      setError("Share sheet unavailable. Use the URL or QR sections below.");
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] backdrop:bg-black/70 max-w-2xl w-[95vw]"
    >
      <div className="p-5 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <h2 className="text-base font-mono uppercase tracking-wider text-[var(--color-green)]">
            Share recipe
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
            aria-label="Close share modal"
          >
            [ × ]
          </button>
        </header>

        {error ? (
          <p
            role="alert"
            className="frame px-3 py-2 text-xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
          >
            {error}
          </p>
        ) : null}

        {/* Native share sheet — surfaced when the platform supports it
            AND we have a public URL to share. Falls below to the four
            sections below regardless. */}
        {isNativeShareSupported && url ? (
          <section>
            <button
              type="button"
              onClick={onNativeShare}
              disabled={isPending}
              className="w-full tap-target text-sm font-mono uppercase tracking-wider px-4 py-2.5 border border-[var(--color-green)] text-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] disabled:opacity-60"
            >
              [ Share via... ]
            </button>
          </section>
        ) : null}

        {/* Section 1: URL */}
        <section className="space-y-2">
          <h3 className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
            Short URL
          </h3>
          {url ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-2 py-1.5 frame font-mono text-xs bg-[var(--color-bg)] text-[var(--color-fg)] min-w-0"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onCopy("url", url)}
                  className={clsx(
                    "text-2xs font-mono uppercase tracking-wider px-2 py-1 border border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:text-[var(--color-green)]",
                    isPending && "opacity-60",
                  )}
                >
                  {copiedKey === "url" ? "[ copied! ]" : "[ copy ]"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleRegenerate}
                  className="text-2xs font-mono uppercase tracking-wider px-2 py-1 border border-[var(--color-border-strong)] hover:border-[var(--color-amber)] hover:text-[var(--color-amber)] disabled:opacity-60"
                >
                  [ regen ]
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleUnpublish}
                  className="text-2xs font-mono uppercase tracking-wider px-2 py-1 border border-[var(--color-border-strong)] hover:border-[var(--color-red)] hover:text-[var(--color-red)] disabled:opacity-60"
                >
                  [ unpublish ]
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                Not published yet.
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={handlePublish}
                className="text-2xs font-mono uppercase tracking-wider px-3 py-1.5 border border-[var(--color-green)] text-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] disabled:opacity-60"
              >
                {isPending ? "[ … ]" : "[ publish ]"}
              </button>
            </div>
          )}
        </section>

        {/* Section 2: QR */}
        {url ? (
          <section className="space-y-2">
            <h3 className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              QR Code
            </h3>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="frame p-2 bg-[var(--color-bg-elevated)]">
                <QrCode text={url} size={196} ariaLabel={`QR for ${url}`} />
              </div>
              <button
                type="button"
                onClick={onDownloadQr}
                className="text-2xs font-mono uppercase tracking-wider px-3 py-1.5 border border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:text-[var(--color-green)]"
              >
                [ download SVG ]
              </button>
            </div>
          </section>
        ) : null}

        {/* Section 3: Markdown */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              Markdown (Reddit / Discord)
            </h3>
            <button
              type="button"
              onClick={() => onCopy("md", markdown)}
              className="text-2xs font-mono uppercase tracking-wider px-2 py-1 border border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:text-[var(--color-green)]"
            >
              {copiedKey === "md" ? "[ copied! ]" : "[ copy ]"}
            </button>
          </div>
          <textarea
            readOnly
            value={markdown}
            onFocus={(e) => e.currentTarget.select()}
            rows={8}
            className="w-full px-2 py-2 frame font-mono text-2xs bg-[var(--color-bg)] text-[var(--color-fg)] resize-y min-h-[8rem]"
          />
        </section>

        {/* Section 4: JSON */}
        <section className="space-y-2">
          <details className="group">
            <summary className="cursor-pointer text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]">
              JSON export
            </summary>
            <div className="mt-2 space-y-2">
              <textarea
                readOnly
                value={jsonString}
                onFocus={(e) => e.currentTarget.select()}
                rows={6}
                className="w-full px-2 py-2 frame font-mono text-2xs bg-[var(--color-bg)] text-[var(--color-fg)] resize-y min-h-[6rem]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onCopy("json", jsonString)}
                  className="text-2xs font-mono uppercase tracking-wider px-2 py-1 border border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:text-[var(--color-green)]"
                >
                  {copiedKey === "json" ? "[ copied! ]" : "[ copy ]"}
                </button>
                <button
                  type="button"
                  onClick={onDownloadJson}
                  className="text-2xs font-mono uppercase tracking-wider px-2 py-1 border border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:text-[var(--color-green)]"
                >
                  [ download .json ]
                </button>
              </div>
            </div>
          </details>
        </section>
      </div>
    </dialog>
  );
}
