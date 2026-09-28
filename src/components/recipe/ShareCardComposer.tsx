"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { toPng } from "html-to-image";
import { upload } from "@vercel/blob/client";
import { CheckCircle2, Download, ImagePlus, Plus, Send, X } from "lucide-react";
import { Button, Checkbox, Input, Listbox, ModalDialog, SegmentedToggle } from "@/components/kit";
import { cn } from "@/lib/cn";
import { loadProjectImages } from "@/lib/actions/projectImages";
import { submitRecipeToGallery } from "@/lib/actions/gallerySubmissions";
import {
  createGalleryPostRecipe,
  loadGalleryComposerProjects,
  loadGalleryPostPrefill,
  loadGalleryComposerRecipes,
  loadGalleryComposerRecipe,
  type GalleryComposerProject,
} from "@/lib/actions/galleryPosts";
import { RecipePaintPicker } from "@/components/recipe/RecipePaintPicker";
import { loadKitCatalog } from "@/lib/catalogClient";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { validateImageFile } from "@/lib/blob/limits";
import {
  isNamedRecipe,
  UNNAMED_RECIPE_GALLERY_ERROR,
} from "@/lib/recipes/name";
import { exportableImageSrc } from "@/lib/shareCard/imageSrc";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";
import {
  cardHeightFor,
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
const NOTES_MAX_CHARS = 240;

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
  /** Source recipe, used for preselection. Card edits create a separate snapshot. */
  recipeId?: string | null;
  /**
   * Compose mode — the gallery's "Share your model" entry point. The title,
   * the paints and the notes become editable, a "start from a project"
   * dropdown prefills them, and SUBMIT mints the recipe row itself rather
   * than requiring one up front.
   *
   * All entry points use compose mode by default.
   */
  composable?: boolean;
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
  composable = true,
}: ShareCardComposerProps) {
  const [ratio, setRatio] = useState<ShareCardRatio>("1:1");
  const [notes, setNotes] = useState(initialNotes ?? "");
  // Compose mode edits these; read-only mode mirrors the props into them on
  // open, so every downstream reader (preview, export, submit) has ONE
  // source and the two modes can never render differently.
  const [title, setTitle] = useState(recipeName ?? "");
  const [draftSlots, setDraftSlots] = useState<RecipeSlot[]>(slots);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [parentName, setParentName] = useState("");
  const [modelCount, setModelCount] = useState("");
  const [recipeLabel, setRecipeLabel] = useState(recipeName ?? "");
  const [libraryRecipes, setLibraryRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const prefillRequest = useRef(0);
  const [projects, setProjects] = useState<GalleryComposerProject[] | null>(null);
  const [sourceProjectId, setSourceProjectId] = useState<string>("");
  /** Which of the source project's recipes the painter is building from —
   *  the second dropdown's value. Display only: a composed post ALWAYS mints
   *  its own recipe (see `handleSubmit`), because the card's title comes from
   *  the project while the prefilled recipe carries its own name, and
   *  publishing one under the other's slug would make the gallery tile and
   *  /r/<slug> disagree about what the post is called. */
  const [selectedPrefillId, setSelectedPrefillId] = useState<string>("");
  /** Set once a composed post has minted its recipe, so retrying after a
   *  failed upload reuses that row instead of leaving an orphan behind. */
  const [mintedRecipeId, setMintedRecipeId] = useState<string | null>(null);
  /** The source project's attached recipes. More than one is normal (UX-907),
   *  so the painter gets a second dropdown to choose between them. */
  const [prefillRecipes, setPrefillRecipes] = useState<
    ReadonlyArray<{ id: string; name: string; slots: RecipeSlot[]; notes: string | null }>
  >([]);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<
    ReadonlyArray<{ id: string; brand: string; name: string }>
  >([]);
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Whether the last submit auto-published straight to the live gallery
  // (moderation `pass`) vs landed in the admin review queue (`pending`).
  const [wentLive, setWentLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  useEffect(() => {
    if (!open || !previewRef.current) return;
    const observer = new ResizeObserver(([entry]) => setPreviewScale(Math.min(1, entry.contentRect.width / CARD_DISPLAY_WIDTH)));
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [open, pickingIndex]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localObjectUrls = useRef<Set<string>>(new Set());

  // Reset to a clean slate every time the composer opens for a (possibly
  // different) recipe/photo — otherwise the previous recipe's notes/photo
  // would leak into the next SHARE click.
  useEffect(() => {
    if (!open) return;
    localObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    localObjectUrls.current.clear();
    setLoadingPrefill(false);
    setRatio("1:1");
    setNotes((initialNotes ?? "").slice(0, NOTES_MAX_CHARS));
    setTitle(recipeName ?? "");
    setDraftSlots(slots);
    setSaveToLibrary(false);
    setProjectName("");
    setParentName("");
    setModelCount("");
    setRecipeLabel(recipeName ?? "");
    setSourceProjectId(projectId ?? "");
    setSelectedPrefillId(recipeId ?? "");
    setMintedRecipeId(null);
    setPrefillRecipes([]);
    setPickingIndex(null);
    setError(null);
    setSubmitted(false);
    setWentLive(false);
    setCandidates(
      initialImageUrl
        ? [{ id: "initial", exportSrc: initialImageUrl, isLocal: false }]
        : [],
    );
    setSelectedId(initialImageUrl ? "initial" : null);
    // `slots` is a fresh array identity on most renders, so depending on it
    // would re-run this reset mid-edit and wipe the painter's work. The
    // props are read once per open, which is exactly the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (projectId) void selectSourceProject(projectId, Boolean(recipeName));
    return () => { prefillRequest.current += 1; };
  }, [open]);

  // Compose mode needs the painter's projects (the source dropdown) and the
  // paint catalog (to resolve a picked paint id to its brand/name for the
  // card). Both are lazy and only in compose mode, so the recipe-side entry
  // points stay exactly as cheap as they were.
  useEffect(() => {
    if (!open || !composable) return;
    let alive = true;
    loadGalleryComposerRecipes().then((rows) => { if (alive) setLibraryRecipes(rows); })
      .catch(() => { if (alive) setError("Could not load your recipes. Close and reopen to try again."); });
    {
      loadGalleryComposerProjects()
        .then((rows) => {
          if (alive) setProjects([...rows]);
        })
        .catch(() => {
          if (alive) { setProjects([]); setError("Could not load your projects. Close and reopen to try again."); }
        });
    }
    if (catalog.length === 0) {
      loadKitCatalog()
        .then((paints) => {
          if (alive) {
            setCatalog(paints.map((p) => ({ id: p.id, brand: p.brand, name: p.name })));
          }
        })
        .catch(() => {
          /* best-effort — a picked paint still carries its hex, so the card
             renders; only the printed paint name would be missing. */
        });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, composable]);

  /** Whose photos the composer offers. Compose mode follows the source
   *  dropdown; the recipe-side entry points keep using the recipe's own
   *  attached project. */
  const photoProjectId = composable ? sourceProjectId || null : (projectId ?? null);

  // Pull the attached project's already-uploaded model photos as pickable
  // candidates (Phase 1 blob uploads) — additive to any initialImageUrl.
  useEffect(() => {
    if (!open || !photoProjectId) { setLoadingImages(false); return; }
    let alive = true;
    setLoadingImages(true);
    loadProjectImages(photoProjectId)
      .then((rows) => {
        if (!alive) return;
        setCandidates((prev) => {
          const known = new Set(prev.map((c) => c.exportSrc));
          const fromProject = rows
            .filter((r) => !known.has(r.url))
            .map((r): ImageCandidate => ({ id: r.id, exportSrc: r.url, isLocal: false }));
          const next = [...prev, ...fromProject];
          setSelectedId((current) => next.some((c) => c.id === current) ? current : next[0]?.id ?? null);
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
  }, [open, photoProjectId]);

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

  /* ── Compose-mode editing ────────────────────────────────────────────
     A composed post always becomes its OWN recipe, so nothing here has to
     track whether the painter has drifted from the recipe they prefilled
     from — the title on the card is the title the post publishes under,
     every time. */

  function applyPrefill(recipe: {
    id: string;
    name: string;
    slots: RecipeSlot[];
    notes: string | null;
  }) {
    setSelectedPrefillId(recipe.id);
    setDraftSlots(recipe.slots);
    setRecipeLabel(recipe.name);
    setNotes((recipe.notes ?? "").slice(0, NOTES_MAX_CHARS));
  }

  async function selectSourceProject(nextProjectId: string, keepRecipe = false) {
    const request = ++prefillRequest.current;
    setSourceProjectId(nextProjectId);
    setPrefillRecipes([]);
    setError(null);
    setProjectName(""); setParentName(""); setModelCount("");
    if (!keepRecipe) {
      setTitle(""); setSelectedPrefillId(""); setDraftSlots([]); setRecipeLabel(""); setNotes("");
      setCandidates([]); setSelectedId(null);
    }
    if (!nextProjectId) { setLoadingPrefill(false); return; }
    setLoadingPrefill(true);
    try {
      const res = await loadGalleryPostPrefill(nextProjectId);
      if (request !== prefillRequest.current) return;
      if (!res.ok) { setError(res.error); return; }
      setProjectName(res.data.projectTitle);
      setParentName(res.data.parentTitle ?? "");
      setModelCount(String(res.data.modelCount));
      if (!keepRecipe) setTitle(res.data.projectTitle);
      setPrefillRecipes(res.data.recipes);
      if (!keepRecipe) {
        const first = res.data.recipes[0];
        if (first) applyPrefill(first);
        else setNotes((res.data.notes ?? "").slice(0, NOTES_MAX_CHARS));
      }
    } catch {
      if (request === prefillRequest.current) setError("Could not load that project. Please try again.");
    } finally {
      if (request === prefillRequest.current) setLoadingPrefill(false);
    }
  }

  async function selectRecipe(id: string) {
    const request = ++prefillRequest.current;
    setSelectedPrefillId(id);
    if (!id) { setRecipeLabel(""); setDraftSlots([]); setLoadingPrefill(false); return; }
    setLoadingPrefill(true);
    try {
      const recipe = await loadGalleryComposerRecipe(id);
      if (request !== prefillRequest.current) return;
      if (recipe) applyPrefill({ ...recipe, notes: recipe.notes ?? null });
      else setError("Recipe not found. Choose another recipe.");
    } catch {
      if (request === prefillRequest.current) setError("Could not load that recipe. Please try again.");
    } finally {
      if (request === prefillRequest.current) setLoadingPrefill(false);
    }
  }

  /** A picked paint becomes a card square. Brand/name come from the catalog
   *  so the card prints the real paint, not a bare hex — a raw wheel pick
   *  (no paintId) still renders, labelled by its hex. */
  function applyPaintSelection(sel: ColorPickerSelection) {
    const meta = sel.paintId ? catalog.find((p) => p.id === sel.paintId) : null;
    const next: RecipeSlot = {
      paintId: sel.paintId ?? "",
      swatch: sel.hex,
      brand: meta?.brand ?? "Custom",
      name: meta?.name ?? sel.hex,
      layer: "basecoat",
    };
    const at = pickingIndex;
    setDraftSlots(
      at != null && at < draftSlots.length
        ? draftSlots.map((s, i) => (i === at ? next : s))
        : [...draftSlots, next],
    );
    setPickingIndex(null);
  }

  function removeSlot(index: number) {
    setDraftSlots(draftSlots.filter((_, i) => i !== index));
  }

  const selectedImage = candidates.find((c) => c.id === selectedId) ?? null;
  const trimmedNotes = notes.trim().slice(0, NOTES_MAX_CHARS);

  // R4-5 — a recipe the painter hasn't named yet still carries the auto-name,
  // and the card would set it as the headline under our own wordmark. Keep it
  // off the card entirely (a titleless card beats one shouting "UNTITLED
  // RECIPE", on the DOWNLOAD path as much as the gallery one) and refuse the
  // outward-facing action until it has a real name.
  const named = isNamedRecipe(title);
  const cardName = named ? title : null;

  const height = cardHeightFor(ratio, CARD_DISPLAY_WIDTH);
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
    if (draftSlots.length > 12) throw new Error("Choose up to 12 paints for this card.");
    if (cardRef.current.scrollHeight > cardRef.current.clientHeight + 2) {
      throw new Error("This card needs more room. Choose Story format or shorten the title and notes.");
    }
    const images = Array.from(cardRef.current.querySelectorAll("img"));
    await Promise.all(images.map((img) => img.decode()));
    return toPng(cardRef.current, {
      pixelRatio: EXPORT_PIXEL_RATIO,
      style: { transform: "none" },
      backgroundColor: "#0d0d17",
      // NOT cacheBust: true — it appends a `?<timestamp>` query param to
      // every embedded <img> src before fetching, which breaks local
      // picks (blob: object URLs don't support query params) and is
      // unnecessary for proxied Blob URLs anyway (our own route already
      // controls freshness).
    });
  }, [draftSlots.length]);

  const handleDownload = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const dataUrl = await renderCardPng();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = shareCardFilename(cardName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      trackClient(AnalyticsEvent.ShareCardDownloaded, { recipeId: recipeId ?? null });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't export the card: ${err.message}`
          : "Couldn't export the card — try again.",
      );
    } finally {
      setExporting(false);
    }
  }, [cardName, recipeId, renderCardPng]);

  const handleSubmit = useCallback(async () => {
    // Compose mode has no recipe id up front — it mints one below. Every
    // other entry point must already have one.
    if (!recipeId && !composable) return;
    // R4-5 — refuse, and SAY SO, rather than going quiet. The button stays
    // focusable (`aria-disabled`, not `disabled`) precisely so a screen-reader
    // user tabbing the panel reaches it and hears the reason: a `disabled`
    // button is skipped by Tab, and its explanation with it.
    if (!named) {
      setError(UNNAMED_RECIPE_GALLERY_ERROR);
      return;
    }
    if (draftSlots.length > 12) { setError("Choose up to 12 paints for this card. Remove extras before posting."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const dataUrl = await renderCardPng();
      if (!dataUrl) return;
      // Persist edits on the same snapshot when retrying a failed upload.
      let postRecipeId = composable ? mintedRecipeId : recipeId;
      if (composable || !postRecipeId) {
        const created = await createGalleryPostRecipe({
          recipeId: mintedRecipeId ?? undefined,
          title: title.trim(),
          slots: draftSlots.map((s) => ({
            paintId: s.paintId || null,
            hex: s.swatch,
            layer: s.layer,
          })),
          notes: [
            projectName.trim() && `Project: ${projectName.trim()}`,
            parentName.trim() && `Part of: ${parentName.trim()}`,
            modelCount && `Models: ${modelCount}`,
            recipeLabel.trim() && `Recipe: ${recipeLabel.trim()}`,
            notes.trim(),
          ].filter(Boolean).join("\n\n") || null,
          saveToLibrary,
        });
        if (!created.ok) {
          setError(created.error);
          return;
        }
        postRecipeId = created.data.recipeId;
        // Adopt it, so a retry after a failed upload doesn't mint a second.
        setMintedRecipeId(postRecipeId);
      }
      trackClient(AnalyticsEvent.GallerySubmitStarted, { recipeId: postRecipeId });
      const pngBlob = await (await fetch(dataUrl)).blob();
      const uploaded = await upload(
        `gallery-cards/${postRecipeId}/${Date.now()}.png`,
        pngBlob,
        {
          access: "public",
          handleUploadUrl: "/api/gallery-submissions/upload",
          clientPayload: JSON.stringify({ recipeId: postRecipeId }),
        },
      );
      const res = await submitRecipeToGallery({
        recipeId: postRecipeId,
        imageUrl: uploaded.url,
        imagePathname: uploaded.pathname,
        ratio,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      trackClient(AnalyticsEvent.GallerySubmitCompleted, {
        recipeId: postRecipeId,
        status: res.data.status,
      });
      setWentLive(res.data.status === "approved");
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
  }, [
    composable,
    projectName, parentName, modelCount, recipeLabel,
    draftSlots,
    named,
    notes,
    ratio,
    recipeId,
    renderCardPng,
    saveToLibrary,
    mintedRecipeId,
    title,
  ]);

  const hasContent = draftSlots.length > 0 || trimmedNotes.length > 0 || selectedImage != null;

  return (
    <>
    <ModalDialog
      open={open && pickingIndex === null}
      onClose={() => { if (!submitting && !exporting) onClose(); }}
      breadcrumb="GALLERY ▸ CREATE"
      title="Create gallery card"
      width="max-w-3xl"
    >
      <fieldset disabled={submitting || exporting || loadingPrefill} className="flex min-w-0 flex-col gap-6 md:flex-row md:items-start">
        {/* ── Live preview — the exact node handed to html-to-image ────── */}
        <div ref={previewRef} className="flex w-full min-w-0 shrink-0 flex-col items-center gap-2 md:sticky md:top-0 md:w-80">
          <div style={{ width: CARD_DISPLAY_WIDTH * previewScale, height: height * previewScale }}>
          <div ref={cardRef} data-testid="share-card-preview" style={{ width: CARD_DISPLAY_WIDTH, height, transform: `scale(${previewScale})`, transformOrigin: "top left", background: "#0d0d17", color: "#eef2f6", padding: 18, display: "flex", flexDirection: "column", gap: 8, fontFamily: "Arial, sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#68dded", fontSize: 9, letterSpacing: 1 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mini-mainframe-mark.png" alt="Mini Mainframe logo" width={24} height={24} />
              <strong>MINI MAINFRAME</strong>
              <span style={{ marginLeft: "auto", fontSize: 7 }}>PAINT RECIPE</span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.15, overflowWrap: "anywhere" }}>{cardName || "Your painted model"}</p>
              {(projectName || parentName || modelCount) && <p style={{ color: "#aab8c5", fontSize: 8, marginTop: 4, overflowWrap: "anywhere" }}>
                {[projectName !== title ? projectName : "", parentName ? `Part of ${parentName}` : "", modelCount ? `${modelCount} model${modelCount === "1" ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
              </p>}
            </div>
            {selectedImage && <div style={{ flex: "1 1 0", minHeight: ratio === "1:1" ? 48 : 140, overflow: "hidden", background: "#141724" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage.isLocal ? selectedImage.exportSrc : exportableImageSrc(selectedImage.exportSrc)} crossOrigin="anonymous" alt="Painted model" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>}
            {draftSlots.length > 0 && <div>
              <p style={{ color: "#68dded", fontSize: 8, fontWeight: 700, marginBottom: 5 }}>{recipeLabel || "PAINTS USED"}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px" }}>
                {draftSlots.slice(0, 12).map((slot, i) => <div key={i} style={{ display: "flex", gap: 5, alignItems: "center", minWidth: 0 }}>
                  <span style={{ width: 14, height: 14, flexShrink: 0, background: slot.swatch, border: "1px solid #59606a" }} />
                  <span style={{ fontSize: 7.5, lineHeight: 1.15, overflowWrap: "anywhere" }}>{slot.brand && <span style={{ display: "block", color: "#aab8c5", fontSize: 6 }}>{slot.brand}</span>}{slot.name}</span>
                </div>)}
              </div>
            </div>}
            {trimmedNotes && <div style={{ borderTop: "1px solid #313547", paddingTop: 6 }}>
              <p style={{ fontSize: 7, color: "#68dded", fontWeight: 700, marginBottom: 3 }}>TECHNIQUE NOTES</p>
              <p style={{ fontSize: 8, lineHeight: 1.35, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{trimmedNotes}</p>
            </div>}
            {!hasContent && <p style={{ flex: 1, fontSize: 10, color: "#aab8c5", paddingTop: 30 }}>Add an image, recipe and technique notes to tell your painting story.</p>}
            <a href="https://www.mini-mainframe.com" style={{ marginTop: "auto", borderTop: "1px solid #313547", paddingTop: 7, color: "#68dded", fontSize: 8, textDecoration: "none", letterSpacing: 1 }}>mini-mainframe.com</a>
          </div>
          </div>
          <span className="font-mono text-[10px] text-fg-dim">
            {CARD_EXPORT_WIDTH}×{Math.round(CARD_EXPORT_WIDTH * (height / CARD_DISPLAY_WIDTH))}px
            export
          </span>
        </div>

        {/* ── Controls ──────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {composable && (
            <>
              {/* Painters think in projects, not recipes — "post my
                  Ultramarines", not "post recipe #7". Picking one fills the
                  title, the paints, the notes and the photo shelf in one go;
                  everything stays editable afterwards, and skipping the
                  dropdown entirely is the blank manual post. */}
              <div className="flex flex-col gap-2">
                <span className="label-osd text-fg-dim">Start from a project</span>
                <Listbox
                  value={sourceProjectId}
                  onChange={selectSourceProject}
                  ariaLabel="Start from a project"
                  placeholder={
                    projects === null ? "Loading your projects…" : "Create new — blank card"
                  }
                  size="md"
                  options={[
                    { value: "", label: "Create new — blank card" },
                    ...(projects ?? []).map((p) => ({ value: p.id, label: p.parentTitle ? `${p.parentTitle} / ${p.title}` : p.title })),
                  ]}
                />
                {loadingPrefill && <p role="status" className="text-fg-dim">Loading card details…</p>}

              </div>

              <Input
                label="Title"
                name="gallery-post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What did you paint?"
                maxLength={120}
              />

              <Input label="Project" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Add project" maxLength={80} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Model count" type="number" min={0} max={99999} value={modelCount} onChange={(e) => setModelCount(e.target.value === "" ? "" : String(Math.min(99999, Math.max(0, Math.floor(Number(e.target.value) || 0)))))} placeholder="Add count" />
                <Input label="Part of" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Larger project" maxLength={80} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="label-osd text-fg-dim">Recipe</span>
                <Listbox value={selectedPrefillId} onChange={selectRecipe} ariaLabel="Add recipe" placeholder="Add recipe" options={[
                  { value: "", label: "Create new recipe" },
                  ...Array.from(new Map([...prefillRecipes, ...libraryRecipes].map((r) => [r.id, r])).values()).map((r) => ({ value: r.id, label: r.name })),
                ]} />
                <Input label="Recipe name" value={recipeLabel} onChange={(e) => setRecipeLabel(e.target.value)} placeholder="Add recipe name" maxLength={80} />
              </div>

              {/* The card's colour squares. Each one opens the same Pick &
                  Paint panel the recipe editor uses, so a posted colour is a
                  real catalog paint with a name on the card — not a bare hex
                  nobody can buy. */}
              <div className="flex flex-col gap-2">
                <span className="label-osd text-fg-dim">
                  Paints {draftSlots.length > 0 ? `(${draftSlots.length})` : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  {draftSlots.map((slot, i) => (
                    <div key={`${slot.paintId}-${i}`} className="relative">
                      <button
                        type="button"
                        onClick={() => setPickingIndex(i)}
                        aria-label={`Change ${slot.name}`}
                        className="h-14 w-14 border border-border transition-colors hover:border-cyan"
                        style={{ backgroundColor: slot.swatch }}
                      />
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        aria-label={`Remove ${slot.name}`}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-bg text-fg-dim hover:border-red hover:text-red"
                      >
                        <X size={10} aria-hidden />
                      </button>
                    </div>
                  ))}
                  {draftSlots.length < 12 && (
                    <button
                      type="button"
                      aria-label="Add paint"
                      onClick={() => setPickingIndex(draftSlots.length)}
                      className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 border border-dashed border-border text-fg-dim transition-colors hover:border-cyan/50 hover:text-cyan-lite"
                    >
                      <Plus size={16} aria-hidden />
                      <span className="font-mono text-[8px] uppercase">Paint</span>
                    </button>
                  )}
                </div>
                {draftSlots.length === 0 && (
                  <p className="font-mono text-[11px] text-fg-dim">
                    ▸ Optional — a photo-only card posts fine. Adding the
                    paints is what lets other painters clone it.
                  </p>
                )}
              </div>
            </>
          )}

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
                aria-label="Add image"
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
            <span className="label-osd text-fg-dim">
              {composable ? "Technique" : "Notes"}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Technique notes"
              maxLength={NOTES_MAX_CHARS}
              rows={4}
              placeholder="Add notes / technique…"
              className="w-full resize-y rounded-[6px] border border-border bg-surface px-3 py-2 font-mono text-[13px] text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
            />
            <p className="font-mono text-[11px] text-fg-dim">{notes.length}/{NOTES_MAX_CHARS} characters. Keep it brief for the card.</p>
          </div>

          {/* `role="alert"` so a refusal is announced, not merely drawn — the
              naming guard below is the case that made that matter. */}
          {draftSlots.length > 12 && <p role="alert" className="text-red-text">This recipe has {draftSlots.length} paints. Choose up to 12 for this card.</p>}
          {error && (
            <p role="alert" className="font-mono text-[12px] text-red-text">
              ▸ {error}
            </p>
          )}

          {submitted && (
            <p className="flex items-center gap-2 font-mono text-[12px] text-green">
              <CheckCircle2 size={14} aria-hidden />
              {wentLive
                ? "Live on the gallery now — thanks for sharing!"
                : "Submitted for review — an admin will take a quick look before it shows on the public gallery."}
            </p>
          )}

          {/* Two clearly-labelled, equally-weighted paths — save it yourself,
              or post it to the community gallery. The gallery path is hidden
              for the imageless / unsaved-recipe entry points (no recipeId). */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-1.5">
              <Button
                variant="outlineCyan"
                onClick={handleDownload}
                disabled={exporting || submitting || loadingImages || loadingPrefill}
                className="w-full justify-center"
              >
                <Download size={16} aria-hidden />
                {exporting ? "Rendering…" : "Download card"}
              </Button>
              <p className="label-osd text-fg-dim">
                Save the PNG to post anywhere yourself.
              </p>
            </div>

            {(recipeId || composable) && (
              <div className="flex flex-1 flex-col gap-1.5">
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={submitting || exporting || loadingImages || loadingPrefill}
                  // R4-5 — `aria-disabled` rather than `disabled` while the
                  // recipe is unnamed: the control keeps its place in the Tab
                  // order, so the reason below is reachable and announced with
                  // it. Pressing it explains itself (handleSubmit) instead of
                  // doing nothing.
                  aria-disabled={named ? undefined : true}
                  aria-describedby="share-card-gallery-note"
                  className={cn("w-full justify-center", !named && "opacity-60")}
                >
                  <Send size={16} aria-hidden />
                  {submitting
                    ? "Submitting…"
                    : submitted
                      ? "Resubmit to gallery"
                      : "Post to gallery"}
                </Button>
                <p
                  id="share-card-gallery-note"
                  className={cn("label-osd", named ? "text-fg-dim" : "text-red-text")}
                >
                  {named
                    ? "Publish it to the Mini Mainframe community gallery."
                    : UNNAMED_RECIPE_GALLERY_ERROR}
                </p>
              </div>
            )}
          </div>
          {/* Keeping a copy in the recipe library is optional. */}
          {composable && (
            <label className="flex cursor-pointer items-start gap-2">
              <Checkbox
                checked={saveToLibrary}
                onChange={setSaveToLibrary}
                ariaLabel="Save this to my recipe list"
                className="mt-0.5"
              />
              <span className="font-mono text-[11px] text-fg-dim">
                Save this to my recipe list.{" "}
                <span className="text-fg-muted">
                  Optional. Your source recipe stays unchanged.
                </span>
              </span>
            </label>
          )}

          {/* R4-5 — "cards go live right away" is only true once the recipe
              has a name, so it stays off screen until it is. */}
          {(recipeId || composable) && named && !submitted && (
            <p className="font-mono text-[11px] text-fg-dim">
              ▸ Sharing is open to everyone. Cards go live on{" "}
              <span className="text-cyan-lite">/gallery</span> right away once
              they pass our automatic content check — anything borderline is
              reviewed by an admin first.
            </p>
          )}
        </div>
      </fieldset>
    </ModalDialog>

      {/* The same Pick & Paint panel the recipe editor opens on a slot —
          `paintsOnly`, so a card square is always a real catalog paint. */}
      {composable && (
        <RecipePaintPicker
          open={pickingIndex != null}
          onClose={() => setPickingIndex(null)}
          onSelect={applyPaintSelection}
          contextLabel="Card paint"
          mode={
            pickingIndex != null && pickingIndex < draftSlots.length
              ? "edit-slot"
              : "add-slot"
          }
          initialHex={
            pickingIndex != null ? (draftSlots[pickingIndex]?.swatch ?? null) : null
          }
          initialPaintId={
            pickingIndex != null ? (draftSlots[pickingIndex]?.paintId || null) : null
          }
        />
      )}
    </>
  );
}
