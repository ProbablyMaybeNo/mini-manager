# Post-deploy sweep — 2026-08-05 · production running `f7f1467`

Ross asked for a browser sweep once the audit branch was live. Production now
runs the R2-17 + R4 stack, so this pass re-walks the rewritten surfaces as a
brand-new signed-up user and checks nothing regressed.

Account `sweep0805` was created for this pass and **deleted afterwards through
the app's own Delete-account flow**, along with `auditross4`
(`audit-r3verify@example.com`).

## Fixes confirmed live

| item | evidence on production |
|---|---|
| **R2-17** URL state | opening a project gives `/dashboard?open=QQA6MNjnAkbbW8lp` |
| **R2-17** Back | pops exactly one tier → `/dashboard`, panel closed, roster intact |
| **R2-17** no bounce | waited 3.5s after Back — **no spontaneous navigation** (the original symptom) |
| **R2-17** no residue | **5 open/close cycles, `history.length` growth = 0** (was: one stale entry per open) |
| **R2-17** Focus path | Focus from the inspector reaches `/focus` (was 0/6) |
| **R4-8** roster row | the opener is a `td button` inside the row — which is *why* the cycle test above could find it |
| **R4-7** in-app nav | started a timer, went to LIBRARY and back: **00:00:33, still "Stop", still ticking** (33→36) |
| **R4-7** hard reload | **00:00:59, still running**; persisted under `mm.focus.session` |
| **R4-5** gallery guard | headline reads "ADD A PHOTO, PAINT STEP, OR NOTES" — the placeholder never reaches the card. Post to gallery is `aria-disabled="true"` (**not** `disabled`, so the reason is reachable) with "Give this recipe a name before posting it to the gallery — the name is the card's headline." |
| **R4-6** today | `aria-current="date"`, weight 700 vs 400, ring vs none — **identical colour**, so it survives greyscale |
| **R4-4** row controls | collection Edit/Delete now 28x28 (was 14x14) |
| **R4-1/2/3** dialog | field's label resolves ("Paint name"), focus lands **on the field**, Escape restores to **+ PAINT** not `<body>` |
| retailers | Amazon and eBay gone; five remain |

**My own R4-5 finding, corrected against production:** `/recipes/new` arrives
with the title field **pre-filled "Untitled recipe"** — read directly off
`.value`, which is the check I failed to do when I originally filed it as "the
form is empty, nothing validates". The builder's correction was right.

## ONE NEW FINDING

- **R5-1 · P3 · The delete-account confirm field has no accessible name.**
  `#confirm-username` in the Danger Zone dialog: `input.labels` empty,
  `aria-label` and `aria-labelledby` both `null`. A screen reader announces an
  unnamed edit box in **the most destructive dialog in the app** — the one
  whose whole purpose is "type your username to confirm".

  This is **R4-1 surviving in a second place**. R4-1's fix routed
  `PromptDialog` through the kit `Input`, which wires `htmlFor` correctly. This
  dialog is hand-rolled on `ModalDialog` with its own `<input>`, so it never
  picked the fix up.
  **The rest of the dialog is right** — focus lands on the field (R4-3's
  pattern applied here), "Delete forever" stays `disabled` until the username
  matches, and the copy names the exact username to type. Only the label is
  missing.
  **Fix:** same as R4-1 — give the field a real label association, or route it
  through the kit `Input` which already does.

## Checked, not defects

- Sign-in's unnamed-looking button is the password toggle:
  `aria-label="Reveal characters"`, `aria-pressed`, 24x24 — correct.
- `/dashboard` signed out → `/sign-in?from=%2Fdashboard`, correct.
- Sign-in and sign-up fields all labelled, `autocomplete` correct
  (`username` / `current-password`).
- New account raises **no** stacked onboarding dialogs (R3-1 holding).
- Production health: `/` 200 (0.38s), `/sign-in` 200 (0.30s), `/gallery` 200 (0.96s).
