"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
import { ChevronLeft, ChevronRight, Share2, Trash2, Upload as UploadIcon } from "lucide-react";
import { Button, EmptyState, IconButton, ModalDialog } from "@/components/kit";
import {
  deleteProjectImage,
  loadProjectImages,
  recordProjectImage,
} from "@/lib/actions/projectImages";
import { MAX_IMAGES_PER_PROJECT, validateImageFile } from "@/lib/blob/limits";
import { cn } from "@/lib/cn";
import type { ProjectImage } from "@/db/schema";
import { ShareCardComposer } from "@/components/recipe/ShareCardComposer";

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Recipe-card phase 1 — the project page's model-photo panel. Shows the
 * current uploaded photo with `< >` cycle controls, an UPLOAD button, and
 * a click-to-open full-screen viewer with a thumbnail strip. Rendered
 * inside the DETAILS section's CollapsibleSection by the caller
 * (ProjectWorkspaceBody) — this component owns only the photo UI, not the
 * surrounding panel chrome.
 *
 * Upload is a client upload: the browser PUTs the file straight to Vercel
 * Blob (via `upload()`, which first fetches a scoped token from
 * `/api/project-images/upload`), then `recordProjectImage` persists the
 * resulting url/pathname as a DB row. Delete + cycle are optimistic;
 * reorder is a fast-follow (the `reorderProjectImages` action already
 * ships — see `src/lib/actions/projectImages.ts`).
 */
export function ProjectImagePanel({ projectId }: { projectId: string }) {
  const [images, setImages] = useState<ProjectImage[] | null>(null);
  const [index, setIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setImages(null);
    setIndex(0);
    loadProjectImages(projectId)
      .then((rows) => {
        if (alive) setImages([...rows]);
      })
      .catch(() => {
        if (alive) setImages([]);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const safeIndex = images && images.length > 0 ? Math.min(index, images.length - 1) : 0;
  const current = images && images.length > 0 ? images[safeIndex] : null;

  function cyclePrev() {
    if (!images || images.length < 2) return;
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function cycleNext() {
    if (!images || images.length < 2) return;
    setIndex((i) => (i + 1) % images.length);
  }

  async function handleFile(file: File) {
    setError(null);
    const check = validateImageFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if ((images?.length ?? 0) >= MAX_IMAGES_PER_PROJECT) {
      setError(`This project already has the maximum of ${MAX_IMAGES_PER_PROJECT} photos.`);
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await upload(
        `project-images/${projectId}/${Date.now()}-${safeName}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/project-images/upload",
          clientPayload: JSON.stringify({ projectId }),
        },
      );
      const res = await recordProjectImage({
        projectId,
        url: blob.url,
        pathname: blob.pathname,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const saved = res.data;
      setImages((prev) => {
        const next = [...(prev ?? []), saved];
        setIndex(next.length - 1);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  }

  function handleDelete(id: string) {
    setError(null);
    setImages((prev) => {
      if (!prev) return prev;
      const next = prev.filter((img) => img.id !== id);
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
    void deleteProjectImage({ id }).then((res) => {
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFileChange}
        aria-label="Upload a model photo"
      />

      {images === null ? (
        <p className="font-body text-body text-fg-dim">▸ Loading photos…</p>
      ) : current ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="block w-full overflow-hidden border border-cyan/30 focus:outline-none focus-visible:border-cyan"
            aria-label="View photo full-screen"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={`Model photo ${safeIndex + 1} of ${images.length}`}
              className="aspect-square w-full object-cover"
            />
          </button>

          {images.length > 1 && (
            <>
              <IconButton
                variant="secondary"
                size="sm"
                aria-label="Previous photo"
                onClick={cyclePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-bg/80"
              >
                <ChevronLeft size={16} aria-hidden />
              </IconButton>
              <IconButton
                variant="secondary"
                size="sm"
                aria-label="Next photo"
                onClick={cycleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-bg/80"
              >
                <ChevronRight size={16} aria-hidden />
              </IconButton>
              <span className="absolute bottom-2 right-2 border border-cyan/30 bg-bg/80 px-1.5 py-0.5 font-body text-[0.65rem] tabular-nums text-fg-dim">
                {safeIndex + 1}/{images.length}
              </span>
            </>
          )}

          <IconButton
            variant="outlineRed"
            size="sm"
            aria-label="Delete this photo"
            title="Delete photo"
            onClick={() => handleDelete(current.id)}
            className="absolute right-2 top-2 h-7 w-7 bg-bg/80"
          >
            <Trash2 size={14} aria-hidden />
          </IconButton>
        </div>
      ) : (
        <EmptyState
          glyph="▦"
          title="No photos yet"
          hint="Upload a photo of your finished model."
          action={{ label: "+ Upload", onClick: () => fileInputRef.current?.click() }}
        />
      )}

      {error && <p className="font-body text-body text-red-text">▸ {error}</p>}

      {current && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon size={16} aria-hidden />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <Button variant="outlineCyan" size="sm" onClick={() => setShareCardOpen(true)}>
            <Share2 size={16} aria-hidden />
            Share
          </Button>
        </div>
      )}

      {viewerOpen && images && images.length > 0 && (
        <FullscreenViewer
          images={images}
          index={safeIndex}
          onIndexChange={setIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Phase 2 — SHARE opens the branded card composer with no recipe data
          attached (the image-section entry point), scoped to this project's
          photos. The composer's imageless/no-recipe fallback still brands
          the download with the MINI-MAINFRAME frame + wordmark. */}
      <ShareCardComposer
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        recipeName={null}
        slots={[]}
        initialNotes={null}
        projectId={projectId}
        initialImageUrl={current?.url ?? null}
      />
    </div>
  );
}

function FullscreenViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ReadonlyArray<ProjectImage>;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const current = images[index];
  if (!current) return null;
  return (
    <ModalDialog open onClose={onClose} title="Model photos" breadcrumb="PHOTOS" width="max-w-4xl">
      <div className="flex flex-col gap-3">
        <div className="relative flex items-center justify-center">
          {images.length > 1 && (
            <IconButton
              variant="secondary"
              size="md"
              aria-label="Previous photo"
              onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2"
            >
              <ChevronLeft size={18} aria-hidden />
            </IconButton>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`Model photo ${index + 1} of ${images.length}`}
            className="max-h-[65vh] w-full object-contain"
          />
          {images.length > 1 && (
            <IconButton
              variant="secondary"
              size="md"
              aria-label="Next photo"
              onClick={() => onIndexChange((index + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <ChevronRight size={18} aria-hidden />
            </IconButton>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`View photo ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-14 w-14 shrink-0 overflow-hidden border",
                  i === index ? "border-cyan" : "border-border hover:border-cyan/50",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
