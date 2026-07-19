# Feature spec — Scan paints from a photo (bulk-add to Collection)

**Goal:** kill the #1 onboarding friction (typing in a paint rack by hand). A user
photographs their paints → we read the labels with vision → match them to the
7,000-paint library → they confirm → we bulk-add to their Collection.

**Approach:** vision-LLM, NOT classic OCR. Raw OCR (Tesseract) chokes on stylised
paint-pot labels; Claude Haiku vision reads brand + name reliably and we already
use it in this repo (gallery image moderation). Reuse that pattern.

---

## Flow

1. **Entry point** — on the Collection page, next to the existing paste-URL bar
   (`src/components/collection/PasteUrlBar.tsx`), add a **"Scan paints"** button
   that opens a photo picker (`<input type="file" accept="image/*" capture>` so
   phones offer the camera). v1 = one photo at a time.
2. **Client → server action** `scanPaintsFromPhoto(imageBase64)`:
   - Enforce a **per-user daily quota** (reuse the E7 pattern in
     `src/lib/rateLimit/quota.ts`; add `MM_SCAN_DAILY_LIMIT`, default ~20). Vision
     calls cost money — this is required, not optional.
   - Call Claude Haiku vision (reuse the **injectable-client** pattern from
     `src/lib/ai/imageModeration.ts`; same `ANTHROPIC_API_KEY`, same model-override
     env convention). New module `src/lib/ai/paintScan.ts` →
     `scanPaintLabels(imageBase64, client?)`.
   - Prompt (tune it): *"This is a photo of miniature-painting pots/bottles. List
     every paint whose label you can read: the brand (e.g. Citadel, Vallejo, Army
     Painter, Scale75, Pro Acryl) and the exact paint name on the label. Return a
     JSON array of {brand, name}. Skip anything you can't read confidently."*
     Return `[]` on a bad/empty image (fail soft).
   - **Match** each `{brand, name}` against the paint catalog. Find how the catalog
     is loaded server-side (`public/data/paints.json` and/or a paints table — check
     `src/lib/paints/` and `src/db/queries`). Normalise (lowercase, strip
     punctuation), prefer a brand-scoped exact/near-exact name match, fall back to
     fuzzy. Return `{ extracted, match | null, alternates[] }` per item.
   - Return the list to the client. Do **not** persist the photo (privacy +
     simplicity — it's a scan, not an upload).
3. **Confirm UI** (a `ModalDialog` or panel, kit primitives, terminal aesthetic):
   each extracted paint → its matched library paint (swatch + name + brand) with
   accept / pick-an-alternate / reject, plus an **Owned / Wishlist** toggle
   (default Owned). Then **"Add N paints."**
4. **Bulk-add** the confirmed paints to Collection — **reuse the existing add
   path** (find it: `markBought` / wishlist / `scrapeInsert` / a collection action
   in `src/lib/actions/`). Don't invent a new persistence path if one exists.

## Reuse map (find + extend, don't reinvent)
- Vision + injectable client + env model override → `src/lib/ai/imageModeration.ts`
- Quota → `src/lib/rateLimit/quota.ts` (migration for a new counter if that's the pattern)
- Paint catalog + any existing name/brand matching → `src/lib/paints/`, `public/data/paints.json`
- Collection add → existing action in `src/lib/actions/`
- UI → `src/components/kit` (Button, Panel, ModalDialog, Swatch, SegmentedToggle)

## Tests (this repo has real coverage — keep it green, cover new logic)
- Unit: mock the vision client → `scanPaintLabels` parses the JSON list; the matcher
  maps `{brand,name}` → catalog paint (hits, misses, brand-scoping, fuzzy).
- Integration: `scanPaintsFromPhoto` with a mocked vision client + the quota (the
  N+1th call in a day is refused); confirmed items persist to Collection.

## v1 scope (ship small, iterate)
- One photo per scan; Citadel / Vallejo / Army Painter / Scale75 / Pro Acryl focus.
- Confirm-before-add (never auto-add — vision can misread).
- Owned/Wishlist toggle. Multi-photo + auto-match tuning are follow-ups.

## Build protocol
- Match neighbouring-file patterns. Strict TS, no `any`, no new deps unless
  essential. Follow `C:\Users\Admin\.claude\CLAUDE.md`.
- Gate before each commit: `npm run typecheck` (0) · `npm run lint` (0 errors; 49
  pre-existing warnings are fine) · `npm run test:unit` · `npm run test:integration`.
  `npm run build` at the end.
- Commit per logical chunk; body ends `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Work on branch `launch/pre-launch-batch`. **Do NOT merge to `main`** — commit +
  report; a human reviews and merges. Do NOT run `next dev` (corrupts `.next`).
