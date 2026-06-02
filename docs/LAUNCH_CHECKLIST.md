# Launch Checklist

Single source of truth for "what does Ross need to do before recruits land?" Pulls together V2-BUILD-PLAN §14, the credential rotation playbook, the Stripe ship-checklist, the recruit DM template, and the residual P-phase polish items. Living doc — strike items as they ship.

## Verdict (Round 8 audit, 2026-06-01)

# 🟢 Launch — send the invites.

The Round 8 ux-auditor walked the live deploy as a fresh recruit `recruit_r8` across desktop + 375/414px mobile. **Verdict: recruit-ready.** Both headline R7 fixes verified passing in production: custom-hex paint slots persist across reload (R7-001), and edit-slot mode replaces rather than appends (R7-002). All 5 primary recruit flows complete without dead-ends. Zero critical, zero high findings — the 12 remaining items are low/medium polish, post-launch. See `ux-audit/report_v8.md` for the full verification table.

The code side is done. Outstanding tasks are Ross-side: credential rotation, Stripe (deferred until you create the account), and the recruit outreach itself.

## §14 ship-ready criteria (from V2-BUILD-PLAN)

| # | Criterion | Status |
|---|---|---|
| 1 | Every primary flow (§6, all 9) executable end-to-end on desktop AND mobile | ✅ Confirmed via 9 Playwright missions + Phase 12 rebuild |
| 2 | Lighthouse 90+ mobile / 95+ desktop on `/`, `/library`, `/projects`, `/recipes/[id]`, `/tools/eyedropper` | ⚠️ Desktop ✓ at last run; mobile 4 of 5 routes ✓, 3 routes 87-89 (LCP-bound) |
| 3 | 0 TypeScript errors | ✅ Every commit ticks `tsc --noEmit` clean |
| 4 | E2E coverage on flows 1, 2, 3 (the core) | ✅ M1/M2/M3 + M4 + M6 + M9 + M7 (import) — M7.1 TDZ bug fixed 2026-06-01 |
| 5 | Ross uses it as his only paint-planning tool 4 weeks | ⏳ **Ross-side** — start the clock |
| 6 | 10 r/minipainting recruits tested; 7 say "I'd pay for this" | ⏳ **Ross-side** — see `docs/RECRUIT_DM.md` |

## Outstanding code work

### Round 7 UI fixes — ✅ ALL SHIPPED
- R7-1 ✅ `4f33305` Project table inline editing (status/type/recipe/priority popovers)
- R7-2 ✅ `7ec3176` App-wide small-button sweep (14 files demoted to `sm`)
- R7-3 ✅ `17429cc` ColorPicker lightness slider (dark-colour reach unlocked)
- R7-4 ✅ `18a9fa1` Tools "Start with..." (Match + Layering now seedable)
- R7-5 ✅ `e704300` Library mobile-filter trigger (`md:hidden xl:hidden` belt-and-braces)
- R7-6 ✅ `95c7bda` Cyan-on-button purge (Phase 12 discipline reinforced)
- R7-7 ✅ `3380418` Recipe page button sweep (sentinel test pinned)

977 tests passing (+16 over Phase 12 baseline). Typecheck clean. Pushed to main 2026-06-01.

### Round 7 critical fixes (ui-builder in flight)
ux-auditor returned with 30 findings (3 critical, 10 high). 1 phantom (UX-R7-003 — `/tools/layering` doesn't exist). 2 real criticals + 9 high follow-ups in `docs/UI_BACKLOG_R7_CRITICAL.md`. Agent dispatched 2026-06-01; reports back when done.

Real criticals:
- UX-R7-001 Custom wheel "Use this colour" silently drops selection (headline P12 action)
- UX-R7-002 EDIT SLOT panel ambiguates replace-vs-append

### Phase 10 — Stripe pricing gates (deferred until Ross creates Stripe account)
- See `docs/PHASE10_PLAN.md` for 8 milestones
- **Ross-side prerequisite:** create Stripe account + 3 products (Pro Monthly $4 / Pro Lifetime $36 / Founder $26) + copy 5 env vars into Vercel
- Once env vars are in place, fire `milestone-builder docs/PHASE10_PLAN.md --max 8`

### Known test failures — none currently
- `qa_imports.spec.ts M7.1` — ✅ Fixed 2026-06-01. Root cause was a TDZ ReferenceError in `src/app/projects/[id]/page.tsx` — the `progressRows` map read `projectPalettes` before its `await Promise.all` initialiser. Fired the moment an Army with children rendered (which is exactly what Apply does). Moved the await above the map. Affected ANY project with sub-projects — silent 500 in prod for the import flow + any Army containing units.

## Ross's side — pre-launch tasks

### ⚠️ Critical (must do before recruits land)

- [ ] **Revoke exposed credentials.** See `docs/CREDENTIAL_ROTATION.md`. ~20 min total.
  - [ ] PSI API key (Google Cloud Console → Credentials → 🗑️) — leaked in chat history during Lighthouse audit
  - [ ] Turso JWT (pasted during early setup)
  - [ ] Resend API key
  - [ ] Groq API key
  - [ ] `AUTH_SECRET` regeneration (invalidates all current sessions — you'll be signed out)

### Important (do before launch)

- [ ] **Run Lighthouse audit** post-Round-7 work. Use `node scripts/audit-lighthouse.mjs` with a fresh PSI key. Bank numbers in `docs/PERFORMANCE_AUDIT.md`. If mobile still misses 90 on `/`, `/library`, `/projects`, chase the LCP fix (preload critical fonts is the cheapest win).
- [ ] **Stripe account + products** — Steps 1-4 of the ship checklist in `docs/PHASE10_PLAN.md`. ~10 min, no wiring needed until you fire milestone-builder.
- [ ] **Custom domain** — `minimaster.app` or similar, ~$10-15/yr. Vercel project settings → Domains → Add. DNS at registrar.

### Nice-to-have (post-launch polish)

- [ ] **Marketing landing page** at `/` (currently redirects to /sign-in) — Phase 13 if you want one before recruits.
- [ ] **PWA install + offline** — post-launch.

## Recruit launch sequence

When code + credentials are clean:

1. **Personal smoke test** — sign up fresh, walk every primary flow end-to-end on prod. Screenshot anything weird.
2. **4-week solo dogfood** — use Mini Manager as your only paint-planning tool. Track gaps in a notes file or directly in the app.
3. **Reddit post + DMs** — `docs/RECRUIT_DM.md` has the templates. Post to r/minipainting first; if <5 sign-ups in 24h, fan out to faction subs.
4. **Track feedback** in a simple table (10 row minimum). 7-of-10 "I'd pay for this" is the launch gate.

## Files referenced

- `docs/PHASE10_PLAN.md` — Stripe pricing gates (8 milestones)
- `docs/PHASE11_PLAN.md` — App-wide UX overhaul (14 milestones, ✅ shipped)
- `docs/PHASE12_PLAN.md` — Color-first rebuild (24 milestones, ✅ shipped)
- `docs/UI_BACKLOG_R7.md` — Round 7 fixes (7 items, ui-builder running)
- `docs/CREDENTIAL_ROTATION.md` — Credential rotation playbook
- `docs/RECRUIT_DM.md` — Reddit + DM templates
- `docs/PERFORMANCE_AUDIT.md` — Lighthouse baseline + measurement table
- `ux-audit/findings_v[1-7].json` — UX audit history
