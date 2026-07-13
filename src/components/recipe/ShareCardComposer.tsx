"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toPng } from "html-to-image";
import { upload } from "@vercel/blob/client";
import { CheckCircle2, Download, ImagePlus, Send, X } from "lucide-react";
import { Button, ModalDialog, SegmentedToggle } from "@/components/kit";
import { cn } from "@/lib/cn";
import { loadProjectImages } from "@/lib/actions/projectImages";
import { submitRecipeToGallery } from "@/lib/actions/gallerySubmissions";
import { validateImageFile } from "@/lib/blob/limits";
import { exportableImageSrc } from "@/lib/shareCard/imageSrc";
import {
  cardHeightFor,
  computeSwatchGrid,
  SHARE_CARD_RATIOS,
  shareCardFilename,
  type ShareCardRatio,
} from "@/lib/shareCard/layout";
import type { RecipeSlot } from "@/lib/types";

/**
 * Recipe-card phase 2 — the branded, downloadable share card composer.
 *
 * Renders a real DOM node styled to the HEX.CODE frame + MINI-MAINFRAME
 * wordmark, then rasters it client-side with `html-to-image`. Purely
 * client-side: no server action, no Pro gate — sharing is a free marketing
 * mechanic (matches ShareLinkDialog's tier, unlike the Pro-gated public
 * recipe *link*).
 *
 * Every remote model photo is routed through `exportableImageSrc` (the
 * `/api/blob-proxy` same-origin proxy for `*.public.blob.vercel-storage.com`)
 * so the export never hits a tainted-canvas failure from the Blob host's
 * CORS story — see `src/lib/shareCard/imageSrc.ts` for the full rationale.
 */

/** CSS px the card renders at on-screen — comfortably fits the modal on a
 *  phone-width viewport without the caller needing responsive breakpoints. */
const CARD_DISPLAY_WIDTH = 320;
/** Target raster width for the exported PNG — IG/story-safe resolution. */
const CARD_EXPORT_WIDTH = 1080;
/** Scales the on-screen node up to CARD_EXPORT_WIDTH on export — well past a
 *  flat 2x device-pixel-ratio, so the download stays crisp on any display. */
const EXPORT_PIXEL_RATIO = CARD_EXPORT_WIDTH / CARD_DISPLAY_WIDTH;
/** A square can't legibly hold its full name much past this many characters
 *  before the caption-below layout (small squares) reads better anyway; kept
 *  only as a length cap for the overlay so a very long paint name never spills
 *  out of its scrim. */
const NOTES_MAX_CHARS = 420;

interface ImageCandidate {
  id: string;
  /** Original URL — used as the on-screen <img> src too (proxying only
   *  matters for the captured clone, but using it everywhere keeps the
   *  preview and the export pixel-identical). */
  exportSrc: string;
  isLocal: boolean;
  /** Local picks carry the object URL so it can be revoked on cleanup. */
  objectUrl?: string;
}

export interface ShareCardComposerProps {
  open: boolean;
  onClose: () => void;
  /** Null/empty → the imageless/no-recipe fallback: just the frame + wordmark
   *  around whatever photo is picked. */
  recipeName: string | null;
  slots: RecipeSlot[];
  initialNotes?: string | null;
  /** When set, the composer offers this project's already-uploaded model
   *  photos (Phase 1 blob uploads) as pickable cover images. */
  projectId?: string | null;
  /** Preselect a specific already-known photo (e.g. the one currently shown
   *  in ProjectImagePanel) ahead of the project's full list loading. */
  initialImageUrl?: string | null;
  /** Recipe-card phase 3 — the recipe this card belongs to. Required for
   *  SUBMIT (a gallery card is always tied to a real, saved recipe); null
   *  for the imageless project-photo entry point and for an unsaved "new"
   *  recipe draft, both of which hide the SUBMIT button. */
  recipeId?: string | null;
}

export function ShareCardComposer({
  open,
  onClose,
  recipeName,
  slots,
  initialNotes,
  projectId,
  initialImageUrl,
  recipeId,
}: ShareCardComposerProps) {
  const [ratio, setRatio] = useState<ShareCardRatio>("1:1");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localObjectUrls = useRef<Set<string>>(new Set());

  // Reset to a clean slate every time the composer opens for a (possibly
  // different) recipe/photo — otherwise the previous recipe's notes/photo
  // would leak into the next SHARE click.
  useEffect(() => {
    if (!open) return;
    setRatio("1:1");
    setNotes(initialNotes ?? "");
    setError(null);
    setSubmitted(false);
    setCandidates(
      initialImageUrl
        ? [{ id: "initial", exportSrc: initialImageUrl, isLocal: false }]
        : [],
    );
    setSelectedId(initialImageUrl ? "initial" : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipeName, initialNotes, initialImageUrl]);

  // Pull the attached project's already-uploaded model photos as pickable
  // candidates (Phase 1 blob uploads) — additive to any initialImageUrl.
  useEffect(() => {
    if (!open || !projectId) return;
    let alive = true;
    setLoadingImages(true);
    loadProjectImages(projectId)
      .then((rows) => {
        if (!alive) return;
        setCandidates((prev) => {
          const known = new Set(prev.map((c) => c.exportSrc));
          const fromProject = rows
            .filter((r) => !known.has(r.url))
            .map((r): ImageCandidate => ({ id: r.id, exportSrc: r.url, isLocal: false }));
          const next = [...prev, ...fromProject];
          if (!selectedId && next.length > 0) setSelectedId(next[0].id);
          return next;
        });
      })
      .catch(() => {
        /* best-effort — the composer still works with local file picks only */
      })
      .finally(() => {
        if (alive) setLoadingImages(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  // Revoke every local object URL on unmount so we never leak blob: handles.
  useEffect(() => {
    const urls = localObjectUrls.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    localObjectUrls.current.add(objectUrl);
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCandidates((prev) => [...prev, { id, exportSrc: objectUrl, isLocal: true, objectUrl }]);
    setSelectedId(id);
  }

  function removeCandidate(id: string) {
    setCandidates((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
        localObjectUrls.current.delete(target.objectUrl);
      }
      const next = prev.filter((c) => c.id !== id);
      setSelectedId((sel) => (sel === id ? (next[0]?.id ?? null) : sel));
      return next;
    });
  }

  const selectedImage = candidates.find((c) => c.id === selectedId) ?? null;
  const trimmedNotes = notes.trim().slice(0, NOTES_MAX_CHARS);

  const height = cardHeightFor(ratio, CARD_DISPLAY_WIDTH);
  // Inner frame sits inset from the card edge; the swatch grid gets whatever
  // width remains inside that frame + the content column's own padding.
  const FRAME_INSET = 16;
  const CONTENT_PADDING = 20;
  const swatchAreaWidth = CARD_DISPLAY_WIDTH - (FRAME_INSET + CONTENT_PADDING) * 2;
  const grid = useMemo(
    () => computeSwatchGrid({ ratio, slotCount: slots.length, areaWidthPx: swatchAreaWidth }),
    [ratio, slots.length, swatchAreaWidth],
  );

  /** Raster the live preview node to a PNG data URL. Shared by DOWNLOAD and
   *  SUBMIT so both export byte-identical cards. */
  const renderCardPng = useCallback(async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    // Wait for JetBrains Mono (and any future custom face) to finish
    // loading — otherwise the raster can catch the fallback system face
    // mid-swap.
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready;
    }
    return toPng(cardRef.current, {
      pixelRatio: EXPORT_PIXEL_RATIO,
      backgroundColor: "#0d0d17",
      // NOT cacheBust: true — it appends a `?<timestamp>` query param to
      // every embedded <img> src before fetching, which breaks local
      // picks (blob: object URLs don't support query params) and is
      // unnecessary for proxied Blob URLs anyway (our own route already
      // controls freshness).
    });
  }, []);

  const handleDownload = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const dataUrl = await renderCardPng();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = shareCardFilename(recipeName);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't export the card: ${err.message}`
          : "Couldn't export the card — try again.",
      );
    } finally {
      setExporting(false);
    }
  }, [recipeName, renderCardPng]);

  const handleSubmit = useCallback(async () => {
    if (!recipeId) return;
    setSubmitting(true);
    setError(null);
    try {
      const dataUrl = await renderCardPng();
      if (!dataUrl) return;
      const pngBlob = await (await fetch(dataUrl)).blob();
      const uploaded = await upload(
        `gallery-cards/${recipeId}/${Date.now()}.png`,
        pngBlob,
        {
          access: "public",
          handleUploadUrl: "/api/gallery-submissions/upload",
          clientPayload: JSON.stringify({ recipeId }),
        },
      );
      const res = await submitRecipeToGallery({
        recipeId,
        imageUrl: uploaded.url,
        imagePathname: uploaded.pathname,
        ratio,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't submit the card: ${err.message}`
          : "Couldn't submit the card — try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [ratio, recipeId, renderCardPng]);

  const hasContent = slots.length > 0 || trimmedNotes.length > 0 || selectedImage != null;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      breadcrumb="RECIPE ▸ SHARE"
      title="Share as card"
      width="max-w-3xl"
    >
      <div className="flex max-h-[75vh] flex-col gap-6 overflow-y-auto pr-1 md:flex-row md:items-start">
        {/* ── Live preview — the exact node handed to html-to-image ────── */}
        <div className="flex shrink-0 flex-col items-center gap-2 md:sticky md:top-0">
          <div
            ref={cardRef}
            className="relative overflow-hidden bg-bg"
            style={{ width: CARD_DISPLAY_WIDTH, height }}
          >
            {/* Thin outline frame, "broken" at the top by the wordmark badge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute border border-cyan/60"
              style={{ inset: FRAME_INSET }}
            />
            <div
              className="absolute left-1/2 bg-bg px-2"
              style={{ top: FRAME_INSET, transform: "translate(-50%, -50%)" }}
            >
              <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.1em] text-cyan">
                MINI-MAINFRAME
              </span>
            </div>

            <div
              className="absolute flex flex-col gap-3"
              style={{
                top: FRAME_INSET + CONTENT_PADDING,
                right: CONTENT_PADDING,
                bottom: CONTENT_PADDING,
                left: CONTENT_PADDING,
              }}
            >
              {recipeName && (
                <p className="truncate text-center font-display text-[13px] font-bold uppercase tracking-tight text-fg-bright">
                  {recipeName}
                </p>
              )}

              {selectedImage && (
                <div className="min-h-0 flex-1 overflow-hidden border border-cyan/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      selectedImage.isLocal
                        ? selectedImage.exportSrc
                        : exportableImageSrc(selectedImage.exportSrc)
                    }
                    crossOrigin="anonymous"
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {slots.length > 0 && (
                <div
                  className="grid shrink-0"
                  style={{
                    gridTemplateColumns: `repeat(${grid.columns}, ${grid.swatchSizePx}px)`,
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  {slots.slice(0, 12).map((slot, i) => (
                    <div
                      key={i}
                      className="relative overflow-hidden border border-fg/20"
                      style={{
                        width: grid.swatchSizePx,
                        height: grid.swatchSizePx,
                        backgroundColor: slot.swatch,
                      }}
                    >
                      {grid.nameInsideSwatch ? (
                        <div
                          className="absolute inset-x-0 bottom-0 px-1 py-1"
                          style={{
                            background:
                              "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))",
                          }}
                        >
                          <span className="line-clamp-2 font-mono text-[8px] font-bold leading-tight text-white">
                            {slot.name}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {slots.length > 0 && !grid.nameInsideSwatch && (
                <div
                  className="grid shrink-0 -mt-1"
                  style={{
                    gridTemplateColumns: `repeat(${grid.columns}, ${grid.swatchSizePx}px)`,
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  {slots.slice(0, 12).map((slot, i) => (
                    <span
                      key={i}
                      className="line-clamp-2 text-center font-mono text-[7px] leading-tight text-fg-dim"
                      style={{ width: grid.swatchSizePx }}
                    >
                      {slot.name}
                    </span>
                  ))}
                </div>
              )}

              {trimmedNotes && (
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden border border-border bg-surface/60 p-2">
                  <span className="font-display text-[8px] font-bold uppercase tracking-[0.12em] text-cyan-lite">
                    Notes
                  </span>
                  <p className="line-clamp-6 whitespace-pre-wrap font-mono text-[8px] leading-relaxed text-fg">
                    {trimmedNotes}
                  </p>
                </div>
              )}

              {!hasContent && (
                <div className="flex flex-1 items-center justify-center">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-fg-muted">
                    Add a photo, paint step, or notes
                  </span>
                </div>
              )}
            </div>
          </div>
          <span className="font-mono text-[10px] text-fg-dim">
            {CARD_EXPORT_WIDTH}×{Math.round(CARD_EXPORT_WIDTH * (height / CARD_DISPLAY_WIDTH))}px
            export
          </span>
        </div>

        {/* ── Controls ──────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="label-osd text-fg-dim">Ratio</span>
            <SegmentedToggle
              options={SHARE_CARD_RATIOS.map((r) => ({ value: r.value, label: r.label }))}
              value={ratio}
              onChange={setRatio}
              aria-label="Card ratio"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="label-osd text-fg-dim">Model photo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload a photo for the card"
            />
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <div key={c.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-label="Use this photo on the card"
                    aria-current={c.id === selectedId}
                    className={cn(
                      "h-14 w-14 overflow-hidden border",
                      c.id === selectedId ? "border-cyan" : "border-border hover:border-cyan/50",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.exportSrc} alt="" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCandidate(c.id)}
                    aria-label="Remove this photo"
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-bg text-fg-dim hover:border-red hover:text-red"
                  >
                    <X size={10} aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 border border-dashed border-border text-fg-dim transition-colors hover:border-cyan/50 hover:text-cyan-lite"
              >
                <ImagePlus size={16} aria-hidden />
                <span className="font-mono text-[8px] uppercase">Add</span>
              </button>
            </div>
            {loadingImages && (
              <p className="font-mono text-[11px] text-fg-dim">▸ Loading project photos…</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="label-osd text-fg-dim">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Card notes"
              rows={4}
              placeholder="Technique notes for the card…"
              className="w-full resize-y rounded-[6px] border border-border bg-surface px-3 py-2 font-mono text-[13px] text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
            />
          </div>

          {error && <p className="font-mono text-[12px] text-red-text">▸ {error}</p>}

          {submitted && (
            <p className="flex items-center gap-2 font-mono text-[12px] text-green">
              <CheckCircle2 size={14} aria-hidden />
              Submitted for review — an admin will approve it before it shows on
              the public gallery.
            </p>
          )}

          {/* Two clearly-labelled, equally-weighted paths — save it yourself,
              or post it to the community gallery. The gallery path is hidden
              for the imageless / unsaved-recipe entry points (no recipeId). */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-1.5">
              <Button
                variant="primary"
                onClick={handleDownload}
                disabled={exporting}
                className="w-full justify-center"
              >
                <Download size={16} aria-hidden />
                {exporting ? "Rendering…" : "Download card"}
              </Button>
              <p className="label-osd text-fg-dim">
                Save the PNG to post anywhere yourself.
              </p>
            </div>

            {recipeId && (
              <div className="flex flex-1 flex-col gap-1.5">
                <Button
                  variant="outlineCyan"
                  onClick={handleSubmit}
                  disabled={submitting || exporting}
                  className="w-full justify-center"
                >
                  <Send size={16} aria-hidden />
                  {submitting
                    ? "Submitting…"
                    : submitted
                      ? "Resubmit to gallery"
                      : "Post to gallery"}
                </Button>
                <p className="label-osd text-fg-dim">
                  Publish it to the Mini Mainframe community gallery.
                </p>
              </div>
            )}
          </div>
          {recipeId && !submitted && (
            <p className="font-mono text-[11px] text-fg-dim">
              ▸ Free to submit. A card goes live on{" "}
              <span className="text-cyan-lite">/gallery</span> only after an
              admin approves it.
            </p>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
