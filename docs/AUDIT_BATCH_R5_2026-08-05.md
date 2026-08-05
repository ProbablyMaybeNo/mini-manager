# Audit batch — round 5, 2026-08-05 · the two survivors, and a guard

Small batch. Two findings, both the **same defect class as something already
fixed** — which is the point: R4-1 and R4-8 each fixed one instance of a
pattern, and one instance of each survived elsewhere. The third item is the
guard that stops this recurring a third time.

Production currently runs `f7f1467` + `c923789`. Evidence:
`ux-audit/round5-postdeploy-2026-08-05/REPORT.md`.

**Rules for this batch**
- Branch off `main`: `fix/audit-round5-2026-08-05`. **Never push or merge to
  `main`.** Commit per item, referencing its id.
- Before EVERY commit: `npm run typecheck` (0 errors), `npm run lint`
  (0 errors), `npm run test:unit`, `npm run test:integration`.
- **Baselines re-measured on `main` today:**

  | check | baseline |
  |---|---|
  | typecheck | 0 errors |
  | lint | 0 errors, **45 warnings** |
  | unit | **938 passed**, 100 files |
  | integration | **539 passed + 1 skipped**, 46 files |
  | E2E | **44 passed, 4 skipped, 0 failed** — `--workers=1` |

- **E2E: run it with `--workers=1`.** In parallel this suite flakes ~1 test per
  full run, and it is the dev server compiling routes on demand, not the app —
  every spec passes in isolation and two serial runs were clean. If you see a
  parallel failure, re-run that spec alone before believing it. Do not "fix" a
  flake by weakening an assertion.
- Do NOT touch `public/data/paints.json` or `public/brand/`. No new deps.

---

- [ ] **R5-1 · P3 · The delete-account confirm field has no accessible name**
  `src/app/(app)/user/account/AccountClient.tsx:259`. Verified on production:
  `#confirm-username` has `input.labels` **empty**, `aria-label` **null**,
  `aria-labelledby` **null**. A screen reader announces an unnamed edit box in
  **the most destructive dialog in the app** — the one whose entire job is
  "type your username to confirm".

  **This is R4-1 surviving in a second place.** R4-1 fixed `PromptDialog` by
  routing it through the kit `Input`'s `label` prop. This dialog *already uses*
  the kit `Input` — it just never passes `label`, so `Input` renders no
  `<label>` at all and the `id` has nothing pointing at it.

  **The rest of the dialog is correct — leave it alone.** Focus lands on the
  field (R4-3's `data-autofocus`), "Delete forever" stays `disabled` until the
  typed text matches, and the copy names the exact username in bold red.
  **Fix:** pass a `label` (the visible copy already says "type your username
  <name> below", so something like "Username" is enough and non-redundant), or
  `aria-label` if a visible label would duplicate that sentence. Your call —
  say which and why.
  **Verify:** the field's accessible name resolves; the delete flow still works
  end to end.

- [ ] **R5-2 · P3 · The mobile roster card is R4-8's construct, unfixed**
  The mobile card is a single `role="button"` named `Manage <title>` containing
  nested interactive controls (progress steppers, swatches, delete). ARIA gives
  `button` presentational children, so focusable descendants inside it are
  invalid — the same violation R4-8 fixed on desktop.

  **It is genuinely less damaging than desktop was**, and the batch that fixed
  R4-8 deliberately left it: there are no `cell`s or `columnheader`s here, so
  the "orphaned cells lose their column context" half does not apply. What
  remains is the nested-interactives-in-a-button half.

  **Two constraints, both real:**
  1. **"Cards are doors" is a locked density rule** (mobile pass 2026-07-27).
     The whole card must stay tappable. R4-8's desktop fix shows the shape that
     satisfies both: the container keeps its click handler and hover, and
     activation moves to a real `<button>` around the title.
  2. **`tests/e2e/qa_mobile_flows.spec.ts` uses that role as a scoping
     region** — `getByRole("button", { name: "Manage <title>" })` appears in
     three assertions, including M6.2's `.click({ position: { x: 12, y: 12 } })`
     which deliberately aims at the card's top-left corner. If you change the
     role, those selectors must change with it, and **M6.2 was only just
     repaired** (see `6f62dd0`) — do not casually rewrite it. Read that commit
     first.

  **If, having looked, you conclude the risk outweighs the benefit — say so and
  stop.** Leaving it with a written reason is an acceptable outcome; breaking
  mobile navigation to satisfy a spec technicality is not.
  **Verify:** at 375x812 the card is still one tap target for a mouse/finger,
  keyboard users can still open a project, no interactive element is nested
  inside a `role="button"`, and `qa_mobile_flows` passes (`--workers=1`).

- [ ] **R5-3 · P3 · Add the guard that stops this class recurring**
  R4-1 and R5-1 are the same bug in two places, found a round apart. R4-8 and
  R5-2 likewise. The fix for *that* is not a third patch — it is a test that
  fails when a new unnamed control appears.

  **Add an E2E guard** that walks the app's main authenticated surfaces and
  opens the dialogs, and asserts **every** `input` / `textarea` / `select` has
  a non-empty accessible name. Playwright can read the accessibility tree
  directly, so this does not need per-field selectors.

  **Static candidates found by grep — verify each in the browser before
  touching it, because the grep has false positives:**

  | location | status |
  |---|---|
  | `AccountClient.tsx:259` | **CONFIRMED broken** — this is R5-1 |
  | `library/FilterPanelContent.tsx:84` (`SearchField name="filter-search"`) | likely — no label, not wrapped |
  | `recipe/AssignToRecipeDialog.tsx:206` | unverified |
  | `dashboard/ProjectWorkspaceBody.tsx:1012, 1038` | **NOT broken** — wrapped in a `<label>`, which associates. Do not "fix". |
  | `kit/Input.tsx:89` | **NOT a usage** — it is `SearchField`'s own definition |
  | `dev/kit/KitGalleryView.tsx:233` | dev-only gallery page; fix only if free |

  **Scope discipline:** fix the genuinely unnamed ones and add the guard. Do
  not refactor every form in the app to route through the kit — three similar
  lines beat a premature abstraction.
  **Verify:** the guard fails if you temporarily strip a label, and passes on
  the fixed tree.

---

## Context worth having

- **R4-5's implementation is the pattern to copy for blocked actions.** It uses
  `aria-disabled="true"` rather than `disabled`, so a screen-reader user can
  still focus the control and hear *why* it is blocked ("Give this recipe a
  name before posting it to the gallery"). If any item here needs to block an
  action, do it that way.
- The whole of R2-17 and the R4 batch was verified live on production
  2026-08-05: Back pops one tier, 5 open/close cycles leave zero history
  residue, the focus session survives both in-app nav and a hard reload, and
  the gallery guard holds. **Do not re-fix any of it.**
