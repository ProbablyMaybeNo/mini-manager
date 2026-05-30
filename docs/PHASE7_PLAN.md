# Mini Manager — Phase 7 Build Plan

Source of truth for the milestone-builder agent. Each unchecked item is a self-contained milestone with scope, patterns, and acceptance criteria. Build top-down. Tick the box when shipped.

**Phase goal:** Power Imports. Paste your army list as plain text → upload it as a PDF → drop in a BattleScribe `.ros` file → watch Mini Manager parse it and auto-populate a project tree (Army → Units → counts). This is the killer feature that turns a 30-minute manual project-creation chore into a 10-second moment-of-magic. It's also the **biggest moat-builder** — no competitor in the wargaming-app space ships an import that maps to a project hierarchy.

**Strategic positioning:**
- Free-tier feature (per the pricing discussion). The painter pastes their 2000pt list → sees ALL their units materialize → realises the free tier only allows 1 project → emotionally invested upsell moment.
- Surfaces as a `[ Import army list ]` button on the empty `/projects` state AND on `/projects/new`.

**Ship criterion:** Ross drops a real BattleScribe `.ros` for one of his armies, watches the project tree populate correctly, edits one count in the preview, applies → lands on the new Army workspace.

**Already shipped (do not re-run):** none — Phase 7 starts fresh on top of Phase 6.

**Remaining (build in this order):**

---

## P7.1 — Import data model + actions + migration

- [x] Build this milestone

**Context.** Imports are first-class entities — every upload attempt gets persisted (input + parsed result + status) so a painter can re-open a half-failed import without re-uploading, and so we have telemetry on parser quality.

**Files to create.**
- `src/db/schema.ts` additions:
  ```
  import (sqliteTable "import")
    id (nanoid)
    ownerId (fk → users.id, cascade)
    sourceFormat (text enum: "plain-text" | "pdf" | "battlescribe-ros" | "battlescribe-rosz")
    sourceTextPreview (text, max 500 chars — for the "what did I upload?" sidebar)
    sourceFileSize (integer, bytes)
    status (text enum: "pending" | "parsed" | "applied" | "failed", default "pending")
    parsedTree (text, JSON-encoded ImportedTree)
    parserConfidence (real, 0-1)
    parserUsed (text — which parser handled it: "text" | "pdf" | "battlescribe" | "llm-fallback")
    errorMessage (text, nullable)
    appliedProjectId (fk → projects.id, set null on delete, nullable)
    createdAt / updatedAt
  -- Index on (ownerId, status); (ownerId, createdAt DESC)
  ```
  Add the new relation to `usersRelations` as `many(imports)`.
- `src/lib/imports/types.ts` — `ImportedTree` shape:
  ```ts
  interface ImportedUnit {
    name: string;
    count: number;
    points?: number;
    notes?: string;       // "Captain in Terminator Armour", "Sergeant Veteran"
  }
  interface ImportedTree {
    armyName: string;
    totalPoints?: number;
    faction?: string;     // best-guess from list ("Adeptus Astartes", "Orks", etc.)
    units: ImportedUnit[];
  }
  ```
- `src/db/queries/imports.ts` — `getImport(userId, id)`, `listImports(userId, opts?)`.
- New Drizzle migration via `npm run db:generate`.

**Files to modify.**
- none beyond the new files.

**Patterns to follow.**
- Same Drizzle conventions: singular SQL name, plural JS const, `id()` helper for nanoid PK, `timestamps` partial.
- JSON in a text column for `parsedTree` is deliberate (small payloads, never queried by inner shape).

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Migration applies cleanly via `npm run db:migrate`.
- A throwaway insert of an `import` row with a sample parsedTree round-trips.

**Commit message:** `P7.1: import schema + types + migration`

---

## P7.2 — Plain-text / Markdown parser (heuristics + confidence)

- [x] Build this milestone

**Context.** Most painters' lists live as plain text — copy-pasted from BattleScribe's text export, NewRecruit's display, forum posts, or hand-typed in Notes. This parser handles all of that with regex heuristics and emits an `ImportedTree` plus a confidence score. Confidence drives the P7.5 LLM fallback decision.

**Files to create.**
- `src/lib/imports/textParser.ts`:
  ```ts
  interface TextParseResult {
    tree: ImportedTree;
    confidence: number;     // 0-1
    warnings: string[];     // user-facing notes about ambiguous lines
  }
  function parseTextList(raw: string): TextParseResult;
  ```
- `src/lib/imports/textHeuristics.ts` — pure helpers:
  - `extractArmyName(lines)` — first heading-like line OR first line if no heading
  - `extractTotalPoints(raw)` — regex for `2000pts`, `1500 points`, `[1850]`
  - `extractFaction(raw)` — match against a known-faction dictionary
  - `parseUnitLine(line)` — extracts `{ name, count, points? }` from common formats:
    - `10x Intercessors` / `Intercessors x10` / `10 Intercessors`
    - `Tactical Squad (10) - 135pts`
    - `## Necron Warriors (20 models, 220pts)`
    - `* Sergeant Vraks (1) — 25pts`
- `tests/fixtures/armylists/text/` — fixture files for common formats:
  - `wtc-40k-marines.txt` — WTC tournament format
  - `newrecruit-aos-stormcast.txt` — NewRecruit display export
  - `goonhammer-40k-orks.txt` — community format
  - `hand-typed-trench-crusade.txt` — informal painter notes
  - `messy-low-confidence.txt` — deliberately ambiguous (drives the P7.5 LLM fallback)

**Files to modify.**
- none beyond the new files.

**Patterns to follow.**
- Pure functions. No I/O. Unit-tested heavily.
- Confidence calculation: weighted sum of (army name detected, total points detected, parseable unit count / total line count, no garbage lines). Final score in [0, 1].
- Warnings array carries human-readable notes ("Line 7: '@hash unit' — couldn't parse, skipped") that surface in the preview UI.
- Faction dictionary is a small static map for v1 — common 40k / AoS / Trench Crusade factions. Per-game expansion comes from real usage data.

**Implementation notes.**
- Don't over-engineer the regex set. v1: 6-8 patterns covering 80% of formats, fall back to LLM (P7.5) for the rest.
- Avoid greedy patterns that eat valid lines as "unparseable" — be conservative, prefer false negatives over hallucinated units.
- Lines starting with `#`, `##`, `**` (bold), or all-caps are heading candidates → potential army name or section break.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds a `textParser` test suite using the 5 fixture files. Each fixture asserts:
  - Detected army name (or absence)
  - Unit count and individual unit `{ name, count }` pairs
  - Confidence in expected range (high for clean formats, low for messy)
- Confidence score for `messy-low-confidence.txt` is < 0.6 (the LLM-fallback trigger threshold).

**Commit message:** `P7.2: plain-text army-list parser + confidence + fixtures`

---

## P7.3 — PDF text extraction

- [x] Build this milestone

**Context.** Painters print their lists via Warhammer App or NewRecruit and end up with PDFs. Goal: extract the text from the PDF, hand it to the text parser from P7.2. No fancy PDF-shape understanding — text extraction is enough for 95% of list PDFs.

**Files to create.**
- `src/lib/imports/pdfExtractor.ts`:
  ```ts
  async function extractPdfText(buffer: ArrayBuffer): Promise<{
    text: string;
    pageCount: number;
    warnings: string[];
  }>;
  ```
- `tests/fixtures/armylists/pdf/` — at least one fixture: `warhammer-app-marines.pdf`. Pull a real export Ross has handy, or synthesize one from a text fixture using a quick `pdfkit` script (committed only if it's small).

**Files to modify.**
- `package.json` — add `pdf-parse` (~50KB, MIT). **Flag in commit body.**

**Patterns to follow.**
- Server-side only — `import "server-only"` at the top. PDF parsing in the browser is doable but heavier and not worth the bundle hit.
- Validation: max 5MB file, max 50 pages. Reject otherwise with a clear error.
- Multi-column layouts (NewRecruit produces these) sometimes confuse text extraction — flag a warning, don't fail.

**Implementation notes.**
- `pdf-parse` returns `{ text, numpages }`. Wrap in our shape with the warnings array.
- Don't OCR scanned PDFs (no embedded text) — return a clear error: "This PDF has no embedded text. Paste the list as text instead, or use a re-typed copy."

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds a PDF extraction test against the fixture. Asserts text contains expected unit names.
- A 0-byte / corrupt PDF rejects with a friendly error.

**Commit message:** `P7.3: PDF text extraction (deps: pdf-parse)`

---

## P7.4 — BattleScribe XML parser (`.ros` + `.rosz`)

- [x] Build this milestone

**Context.** BattleScribe is the de facto roster builder for 40k / AoS / WHFB / Necromunda / many other systems. Painters who use it export `.ros` (XML) or `.rosz` (zipped XML). The schema is well-defined and consistent across games. This is the **highest-quality input source** — confidence should be ~1.0 every time.

**Files to create.**
- `src/lib/imports/battleScribeParser.ts`:
  ```ts
  async function parseBattleScribeRos(text: string): Promise<TextParseResult>;
  async function parseBattleScribeRosz(buffer: ArrayBuffer): Promise<TextParseResult>;
  ```
- `tests/fixtures/armylists/battlescribe/` — at least one `.ros` fixture (`space-marines-2000pts.ros`).

**Files to modify.**
- `package.json` — add `fast-xml-parser` (small, no deps) and `fflate` (for `.rosz` unzip). **Flag both in commit body.**

**Patterns to follow.**
- `.rosz` = ZIP containing one `.ros` file. Use `fflate` to unzip in-memory, then hand the XML to the `.ros` parser.
- BattleScribe roster shape (simplified):
  ```xml
  <roster name="My Army" gameSystemName="Warhammer 40,000">
    <forces><force catalogueName="Adeptus Astartes">
      <selections>
        <selection name="Tactical Squad" type="unit">
          <costs><cost name="pts" value="135"/></costs>
          <selections>
            <selection name="Sergeant" type="model" number="1"/>
            <selection name="Tactical Marine" type="model" number="9"/>
          </selections>
        </selection>
      </selections>
    </force></forces>
  </roster>
  ```
- Walk `selections > selection[type="unit"]` for the unit list. The unit's `count` = sum of nested `selection[type="model"]` numbers, OR `number` attribute if present.

**Implementation notes.**
- Faction → `forces.force.catalogueName`.
- Total points → sum of all unit `<cost name="pts">` values.
- BattleScribe's `selection.number` defaults to 1 if absent.
- For `.rosz`, unzip ALL files but only parse the first `.ros` found — there's only ever one.
- Confidence is 0.95-1.0 unless XML is malformed.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds BattleScribe parser tests against the fixture. Asserts army name, faction, total points, complete unit list with counts.
- Both `.ros` and `.rosz` extensions parse correctly.

**Commit message:** `P7.4: BattleScribe .ros / .rosz parser (deps: fast-xml-parser, fflate)`

---

## P7.5 — LLM-assisted fallback parser

- [ ] Build this milestone

**Context.** When the text parser confidence falls below 0.6 (a "messy" list), call the Anthropic API to convert raw text → structured `ImportedTree`. This is the safety net that makes the import feature work for the long tail of weird formats.

**Files to create.**
- `src/lib/imports/llmFallbackParser.ts`:
  ```ts
  async function parseWithLlm(rawText: string): Promise<TextParseResult>;
  ```
- The prompt template:
  ```
  You receive a raw wargaming army list in any format. Extract structured data.

  Return ONLY a JSON object with this exact shape:
  {
    "armyName": string,
    "totalPoints": number | null,
    "faction": string | null,
    "units": [{ "name": string, "count": number, "points": number | null, "notes": string | null }]
  }

  Rules:
  - Combine multi-line unit descriptions into one entry.
  - "10x Intercessors" → name "Intercessors", count 10.
  - Sergeants / characters with their own profile are separate units with count 1.
  - Skip configuration / equipment lines that aren't units.
  - If you can't parse a section, omit it rather than guessing.

  List follows:
  ---
  {{RAW_LIST}}
  ---

  Reply with ONLY the JSON object, no prose.
  ```

**Files to modify.**
- `package.json` — add `@anthropic-ai/sdk`. **Flag in commit body.**
- `.env.example` + `.env.production.example` — add `ANTHROPIC_API_KEY` row with comment.
- `docs/DEPLOY.md` §3 — add `ANTHROPIC_API_KEY` to the env-var table.

**Patterns to follow.**
- Server-side only — `import "server-only"` at the top.
- Use Claude Haiku 4.5 (the model that's faster + cheaper than Opus, well-suited for structured extraction).
- 15-second timeout. Reject otherwise.
- Cost cap: refuse inputs > 8000 chars (anything bigger is suspicious — real lists are 1-3k chars).
- Parse the response as JSON. If parse fails, return a friendly error + zero-confidence empty tree.
- Confidence on success: 0.7 (LLM extraction is good but not perfect).

**Implementation notes.**
- Anthropic API key required at runtime in production. Add to Vercel env vars before deploying P7.5.
- Don't call the LLM if the text parser already returned confidence >= 0.6 — saves cost and time.
- Cache by content hash if Ross wants — but defer to v2. v1 just calls every time.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:unit` adds an LLM-fallback test that mocks the Anthropic SDK and asserts the parsing pipeline correctly converts mock JSON → ImportedTree.
- Integration test: feed `messy-low-confidence.txt` through the full `parseTextList` → `parseWithLlm` chain; assert tree shape is populated. (This test runs with a real API call gated by an env var so CI doesn't burn credit.)

**Commit message:** `P7.5: LLM-assisted parser fallback (deps: @anthropic-ai/sdk)`

---

## P7.6 — Import UI — upload + paste + preview

- [ ] Build this milestone

**Context.** The painter-facing surface. Drop a file or paste text → see the parsed tree → edit before applying. The preview lets the painter fix anything the parser got wrong without re-uploading.

**Files to create.**
- `src/app/projects/import/page.tsx` — server shell.
- `src/components/imports/ImportClient.tsx` — `'use client'`. Three input methods:
  - **Drop zone** — accepts `.pdf`, `.ros`, `.rosz`. Max 5MB.
  - **Paste** — `<textarea>` for plain-text lists. Max 20,000 chars.
  - **Sample lists** — a small "Try a sample" dropdown with 2-3 fixture lists for painters who want to see how the feature works without uploading their own.
- `src/components/imports/ImportPreview.tsx` — `'use client'`. Shows the parsed tree as an editable form:
  - Army name (editable input)
  - Total points (editable number)
  - Faction (editable input)
  - List of units, each row: name input, count number input, remove button
  - `[ + Add unit ]` button
  - Warnings panel (collapsed if empty)
- `src/components/imports/ImportUpsell.tsx` — server component. When a free-tier user imports a list with >1 unit (i.e. they need more than the free 1-project limit to capture it), surface a Pro upsell modal at the apply step. Free user can still import the FIRST unit; further units are previewed but greyed out + "Pro unlocks all 8" or similar.

**Files to modify.**
- `src/app/projects/page.tsx` — add an `[ Import army list ]` button next to the existing `[ + New project ]` and `<QuickAddBar />`. Empty state should feature the import button prominently.
- `src/components/QuickAddBar.tsx` — no change, but verify it doesn't conflict with the new button visually.

**Patterns to follow.**
- Server actions: `createImport(formData)` handles the upload (PDF/text/.ros/.rosz dispatch to the right parser). `previewImport(importId)` reads the parsed tree. `applyImport(importId, edits)` lands in P7.7.
- The preview component holds local state for edits; `Apply` button serialises to the action.
- Drop zone uses native HTML5 drag-and-drop. No `react-dropzone` dep.
- File size client-side check before upload (reject before round-trip).

**Implementation notes.**
- The upload form posts to a server action that streams the file into memory (Node Buffer), routes to the right parser based on file extension, persists the `import` row with `status = 'parsed'`, then redirects to `/projects/import/[id]/preview`.
- Plain-text paste skips the file upload entirely — submits as form-data text.
- Show the parser used + confidence at the top of the preview ("Parsed via BattleScribe XML, confidence 0.98").

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- Drop a `.ros` file → preview tree populates correctly with editable rows.
- Paste a 40k WTC list → preview populates.
- Edit a count + remove a unit + add a new unit row → state updates locally.
- File > 5MB rejected client-side with a friendly error.

**Commit message:** `P7.6: import UI — upload + paste + preview + edit`

---

## P7.7 — Apply import → create projects + child units

- [ ] Build this milestone

**Context.** The "land everything" moment. Takes the preview tree + the painter's edits and creates the project hierarchy. Then redirects to the new Army project workspace.

**Files to create.**
- `src/lib/actions/imports.ts` — server action `applyImport({ importId, editedTree })`:
  - Verify import ownership.
  - If `editedTree.units.length === 0`, reject ("No units to import").
  - Transaction (or sequential with cleanup):
    1. Create the Army project (parent): `{ name: editedTree.armyName, type: "Army", count: 0, faction: editedTree.faction, pointsValue: editedTree.totalPoints }`.
    2. For each unit in `editedTree.units`, create a Unit project with `parentId = armyId, type: "Unit", count: unit.count, name: unit.name, pointsValue: unit.points, notesMd: unit.notes`.
    3. Update the `imports` row: `status = 'applied', appliedProjectId = armyId`.
  - Return `{ ok: true, armyProjectId }`. The client navigates to `/projects/[armyProjectId]`.
- `src/app/projects/import/[id]/preview/page.tsx` — the preview page. Server component that fetches the import + parsedTree, renders `<ImportPreview />`, has an `[ Apply ]` form action that calls `applyImport`.

**Files to modify.**
- `src/lib/actions/projects.ts` — extract a `createProjectInternal(input, tx)` helper (no Zod re-validation, no revalidatePath) that the bulk apply path can call N times inside one logical transaction. The existing `createProject` server action keeps using the wrapped path.

**Patterns to follow.**
- libsql in-memory doesn't truly transaction (per the P5.3 concern); for the file-backed prod DB, sequential inserts + rollback-on-error is the pattern. Same caveat: if a mid-import crash leaves an orphaned half-Army, painter can delete it manually. Defer real atomic transactions to a future polish pass.
- Names get trimmed before insert (the parsers may emit trailing whitespace).
- Project count constraint: a Unit can have a parent that's an Army. Verify in the action — should already be enforced by P1.6's createProject logic.

**Implementation notes.**
- Pricing-gate hook (P6.10 territory but worth wiring now): if `editedTree.units.length` would push the user beyond their free 1-project limit, the action returns `{ ok: false, error: 'free-tier-limit', upgradeUrl: '/upgrade' }`. The UI converts this into the upsell modal. **This is the killer conversion moment** — they've uploaded their full list, watched it parse, and now the wall hits. Don't water it down.
- Free tier specifically: allow the import to CREATE the Army container (1 project) + ONE Unit child as a preview of capability. The remaining units are listed in the preview as "would create N more units — upgrade to Pro." If the painter upgrades, run the rest of the apply for them automatically.

**Acceptance criteria.**
- `npm run typecheck` exits 0.
- `npm run test:integration` adds an `applyImport` test: seed a user, create an `imports` row with a parsed tree of 5 units, call `applyImport`, verify 1 Army + 5 Unit projects exist with correct parent linkage.
- E2E: drop a `.ros` → preview → apply → land on /projects/[id] of the new Army.

**Commit message:** `P7.7: apply import → create Army + Unit projects`

---

## P7.8 — Test coverage + E2E mission

- [ ] Build this milestone

**Context.** Locks the import flow against regression. The parser layer is the highest-value test surface — painters' lists vary wildly and we want CI to catch a regression on the WTC format or BattleScribe schema drift immediately.

**Files to create.**
- `tests/unit/lib/imports/textParser.test.ts` — table-driven test covering all 5 text fixtures from P7.2.
- `tests/unit/lib/imports/battleScribeParser.test.ts` — assert XML + zip handling against fixtures from P7.4.
- `tests/unit/lib/imports/pdfExtractor.test.ts` — fixture-based assertions from P7.3.
- `tests/integration/actions/imports.test.ts` — `createImport` + `applyImport` against in-memory libsql.
- `tests/e2e/qa_imports.spec.ts` — M7.1: navigate `/projects/import` → paste a text list → preview → apply → land on `/projects/[armyId]`. Assert the army name + first 3 unit names rendered.

**Files to modify.**
- `docs/MISSIONS.md` — add M7 (Imports) section with M7.1 row. Update the headline counts.
- `docs/AGENT_ONBOARDING.md` — add a row to the "What's shipped" table.

**Patterns to follow.**
- Vendor parser tests cite the fixture file path so a maintainer can trace assertion → expected input.
- `applyImport` test asserts both the row writes AND the `imports.status = 'applied'` update.
- E2E uses `signInAs(freshTestEmail())` from `tests/e2e/_helpers/auth.ts`.

**Acceptance criteria.**
- `npm test` total count increases by ~25-30 (combined unit + integration additions).
- `npm run test:e2e qa_imports` passes.
- `docs/MISSIONS.md` reflects the new M7 mission with status `✅ Pass`.

**Commit message:** `P7.8: import test coverage + M7.1 E2E mission`

---

## Phase 7 ship checklist

After P7.8 lands, before declaring Phase 7 done:

- Ross drops his real BattleScribe `.ros` file for ONE of his armies → preview tree populates correctly → applies → lands on the new Army workspace.
- Ross pastes a real plain-text list from r/minipainting or Discord → preview tree populates with >= 0.6 confidence (no LLM fallback needed).
- Ross uploads a Warhammer App PDF → text extracts → preview tree populates.
- A deliberately messy text list triggers the LLM fallback → tree populates with confidence ~0.7.
- `npm test && npm run test:e2e` all green.
- `docs/MISSIONS.md` updated.

**Deferred to later phases (do NOT build in Phase 7):**
- **BattleScribe roster URL import** (paste a share URL → fetch + parse) → v2. Requires BattleScribe Roster Editor to expose share URLs, which they don't reliably.
- **OCR for scanned/printed lists** (camera photo → text) → v2. Needs vision API integration.
- **Smart re-import** (detect already-imported army, merge changes) → v2.
- **Faction-specific point validation** ("Marines: total doesn't add to claimed points") → v2.
- **Multi-list comparison** ("Show me my Tau list vs my Necron list side-by-side") → post-launch.

---

## Conventions for milestone-builder

Same as PHASE1-6_PLAN.md:

- **Commit only locally; do NOT push.** Ross reviews before pushing.
- **Pre-commit:** `npm run typecheck` 0 errors. Refuse to commit if it fails.
- **Pre-commit:** if the milestone added source under `src/lib/` or `src/lib/actions/`, also run `npm test` and commit only if green. **CRITICAL — stage new test files INTO the same commit as the feature they test.** Phase 4 + 5 each leaked test files into orphans (housekeeping commits 26d01ce + 3afc0c3). Don't repeat.
- **Bundle plan-tick INTO the feature commit** (1 commit per milestone). Phase 5's split (16 commits / 8 milestones) was noisier than needed.
- **New dependencies flagged in commit body.** Phase 7 adds: `pdf-parse` (P7.3), `fast-xml-parser` + `fflate` (P7.4), `@anthropic-ai/sdk` (P7.5). All four are necessary, flag them honestly.
- **No `any`. No `@ts-ignore`.** Strict mode mandatory.
- **`"use server"` files export ONLY async functions.** Pure helpers go in `src/lib/<domain>/<name>.ts`. P1 + P3 + (almost) P6 each shipped this bug initially — don't be the fourth.
- **Server-side first.** PDF extraction, XML parsing, LLM calls — all server-only. The browser only sees the structured preview tree.
- **Match existing patterns.** Read neighbouring files in `src/lib/scrape/` (similar shape — parser dispatcher + per-vendor adapters + LLM fallback could land here) before introducing new patterns.
- **Tailwind v4 syntax.** CSS-first `@theme`. Use existing tokens — no arbitrary hex.
- **Halt and report** if a milestone has an architectural decision the plan doesn't cover. Do not guess.
